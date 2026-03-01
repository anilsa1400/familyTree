import { randomUUID } from "crypto";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { db } from "./db";
import {
  familyInputSchema,
  deleteParentChildSchema,
  deleteSpouseSchema,
  parentChildInputSchema,
  personInputSchema,
  spouseInputSchema,
  uiSettingsInputSchema,
} from "./schema";
import {
  FamilyGraph,
  serializeFamily,
  serializeParentChild,
  serializePerson,
  serializeSpouseRelation,
} from "./tree";
import {
  FamilyRecord,
  ParentChildRelationRecord,
  PersonRecord,
  SpouseRelationRecord,
  UiSettingsRecord,
} from "./types";
import { toPersonDbInput, toSpouseDbInput } from "./transform";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const nowIso = () => new Date().toISOString();

const findPersonById = db.prepare("SELECT * FROM persons WHERE id = ?");
const findFamilyById = db.prepare("SELECT * FROM families WHERE id = ?");
const getPersons = db.prepare("SELECT * FROM persons ORDER BY first_name ASC, last_name ASC");
const getParentChildRelations = db.prepare("SELECT * FROM parent_child_relations ORDER BY created_at ASC");
const getSpouseRelations = db.prepare("SELECT * FROM spouse_relations ORDER BY created_at ASC");
const getFamilies = db.prepare("SELECT * FROM families ORDER BY name ASC");
const getUiSettings = db.prepare("SELECT * FROM ui_settings WHERE id = 1");

const buildFamilyGraph = (): FamilyGraph => {
  const families = getFamilies.all() as FamilyRecord[];
  const persons = getPersons.all() as PersonRecord[];
  const parentChildRelations = getParentChildRelations.all() as ParentChildRelationRecord[];
  const spouseRelations = getSpouseRelations.all() as SpouseRelationRecord[];

  return {
    families: families.map(serializeFamily),
    persons: persons.map(serializePerson),
    parentChildRelations: parentChildRelations.map(serializeParentChild),
    spouseRelations: spouseRelations.map(serializeSpouseRelation),
  };
};

const wouldCreateParentChildCycle = (parentId: string, childId: string) => {
  const links = getParentChildRelations.all() as ParentChildRelationRecord[];

  const childrenByParent = new Map<string, string[]>();
  for (const link of links) {
    const children = childrenByParent.get(link.parent_id) ?? [];
    children.push(link.child_id);
    childrenByParent.set(link.parent_id, children);
  }

  const queue = [childId];
  const seen = new Set<string>(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const children = childrenByParent.get(current) ?? [];
    for (const next of children) {
      if (next === parentId) {
        return true;
      }

      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return false;
};

const serializeUiSettings = (settings: UiSettingsRecord) => ({
  activeTab: settings.active_tab,
  activePage: settings.active_page,
  selectedThemeId: settings.selected_theme_id,
  themeEditorMode: settings.theme_editor_mode,
  primaryColorInput: settings.primary_color_input,
  secondaryColorInput: settings.secondary_color_input,
  layoutMode: settings.layout_mode,
  sidebarEnabled: settings.sidebar_enabled === 1,
  showMemberPhotos: settings.show_member_photos === 1,
  updatedAt: settings.updated_at,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tree", (_req, res, next) => {
  try {
    res.json(buildFamilyGraph());
  } catch (error) {
    next(error);
  }
});

app.get("/api/families", (_req, res, next) => {
  try {
    const families = getFamilies.all() as FamilyRecord[];
    res.json(families.map(serializeFamily));
  } catch (error) {
    next(error);
  }
});

app.post("/api/families", (req, res, next) => {
  try {
    const payload = familyInputSchema.parse(req.body);
    const id = randomUUID();
    const timestamp = nowIso();

    db.prepare(
      `INSERT INTO families (
         id,
         name,
         motto,
         description,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.name,
      payload.motto?.trim() || null,
      payload.description?.trim() || null,
      timestamp,
      timestamp,
    );

    const family = findFamilyById.get(id) as FamilyRecord;
    res.status(201).json(serializeFamily(family));
  } catch (error) {
    next(error);
  }
});

app.put("/api/families/:id", (req, res, next) => {
  try {
    const payload = familyInputSchema.parse(req.body);
    const result = db
      .prepare(
        `UPDATE families
         SET name = ?,
             motto = ?,
             description = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        payload.name,
        payload.motto?.trim() || null,
        payload.description?.trim() || null,
        nowIso(),
        req.params.id,
      );

    if (result.changes === 0) {
      res.status(404).json({ message: "Requested record was not found." });
      return;
    }

    const family = findFamilyById.get(req.params.id) as FamilyRecord;
    res.json(serializeFamily(family));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/families/:id", (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM families WHERE id = ?").run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ message: "Requested record was not found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/ui", (_req, res, next) => {
  try {
    const settings = getUiSettings.get() as UiSettingsRecord | undefined;
    if (!settings) {
      res.status(404).json({ message: "UI settings were not found." });
      return;
    }

    res.json(serializeUiSettings(settings));
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/ui", (req, res, next) => {
  try {
    const payload = uiSettingsInputSchema.parse(req.body);

    db.prepare(
      `UPDATE ui_settings
       SET active_tab = ?,
           active_page = ?,
           selected_theme_id = ?,
           theme_editor_mode = ?,
           primary_color_input = ?,
           secondary_color_input = ?,
           sidebar_enabled = ?,
           layout_mode = ?,
           show_member_photos = ?,
           show_customize_toolbar = ?,
           updated_at = ?
       WHERE id = 1`,
    ).run(
      payload.activeTab,
      payload.activePage,
      payload.selectedThemeId,
      payload.themeEditorMode,
      payload.primaryColorInput,
      payload.secondaryColorInput,
      payload.sidebarEnabled ? 1 : 0,
      payload.layoutMode,
      payload.showMemberPhotos ? 1 : 0,
      payload.layoutMode === "TOOLBAR" ? 1 : 0,
      nowIso(),
    );

    const settings = getUiSettings.get() as UiSettingsRecord | undefined;
    if (!settings) {
      res.status(404).json({ message: "UI settings were not found." });
      return;
    }

    res.json(serializeUiSettings(settings));
  } catch (error) {
    next(error);
  }
});

app.post("/api/persons", (req, res, next) => {
  try {
    const payload = personInputSchema.parse(req.body);
    const input = toPersonDbInput(payload);
    const id = randomUUID();
    const timestamp = nowIso();

    db.prepare(
      `INSERT INTO persons (
        id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        date_of_death,
        photo_url,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.firstName,
      input.lastName,
      input.gender,
      input.dateOfBirth,
      input.dateOfDeath,
      input.photoUrl,
      input.notes,
      timestamp,
      timestamp,
    );

    const person = findPersonById.get(id) as PersonRecord;
    res.status(201).json(serializePerson(person));
  } catch (error) {
    next(error);
  }
});

app.put("/api/persons/:id", (req, res, next) => {
  try {
    const payload = personInputSchema.parse(req.body);
    const input = toPersonDbInput(payload);
    const result = db
      .prepare(
        `UPDATE persons
         SET first_name = ?,
             last_name = ?,
             gender = ?,
             date_of_birth = ?,
             date_of_death = ?,
             photo_url = ?,
             notes = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.firstName,
        input.lastName,
        input.gender,
        input.dateOfBirth,
        input.dateOfDeath,
        input.photoUrl,
        input.notes,
        nowIso(),
        req.params.id,
      );

    if (result.changes === 0) {
      res.status(404).json({ message: "Requested record was not found." });
      return;
    }

    const person = findPersonById.get(req.params.id) as PersonRecord;
    res.json(serializePerson(person));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/persons/:id", (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM persons WHERE id = ?").run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ message: "Requested record was not found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/relations/parent-child", (req, res, next) => {
  try {
    const payload = parentChildInputSchema.parse(req.body);

    if (payload.parentId === payload.childId) {
      res.status(400).json({ message: "Parent and child cannot be the same person." });
      return;
    }

    const parent = findPersonById.get(payload.parentId) as PersonRecord | undefined;
    const child = findPersonById.get(payload.childId) as PersonRecord | undefined;

    if (!parent || !child) {
      res.status(404).json({ message: "Parent or child not found." });
      return;
    }

    if (wouldCreateParentChildCycle(payload.parentId, payload.childId)) {
      res.status(400).json({ message: "This relationship would create a cycle in the family tree." });
      return;
    }

    const id = randomUUID();
    const createdAt = nowIso();

    db.prepare(
      `INSERT INTO parent_child_relations (id, parent_id, child_id, relation_type, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, payload.parentId, payload.childId, payload.relationType, createdAt);

    const relation = db
      .prepare("SELECT * FROM parent_child_relations WHERE id = ?")
      .get(id) as ParentChildRelationRecord;

    res.status(201).json(serializeParentChild(relation));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/relations/parent-child", (req, res, next) => {
  try {
    const parsed = deleteParentChildSchema.parse({
      parentId: req.query.parentId,
      childId: req.query.childId,
    });

    const result = db
      .prepare("DELETE FROM parent_child_relations WHERE parent_id = ? AND child_id = ?")
      .run(parsed.parentId, parsed.childId);

    if (result.changes === 0) {
      res.status(404).json({ message: "Requested record was not found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/relations/spouse", (req, res, next) => {
  try {
    const payload = spouseInputSchema.parse(req.body);
    if (payload.personAId === payload.personBId) {
      res.status(400).json({ message: "A person cannot be their own spouse." });
      return;
    }

    const normalized = toSpouseDbInput(payload);

    const personA = findPersonById.get(normalized.personAId) as PersonRecord | undefined;
    const personB = findPersonById.get(normalized.personBId) as PersonRecord | undefined;

    if (!personA || !personB) {
      res.status(404).json({ message: "One or both spouses were not found." });
      return;
    }

    const id = randomUUID();
    const createdAt = nowIso();

    db.prepare(
      `INSERT INTO spouse_relations (
        id,
        person_a_id,
        person_b_id,
        married_at,
        divorced_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      normalized.personAId,
      normalized.personBId,
      normalized.marriedAt,
      normalized.divorcedAt,
      createdAt,
    );

    const relation = db.prepare("SELECT * FROM spouse_relations WHERE id = ?").get(id) as SpouseRelationRecord;
    res.status(201).json(serializeSpouseRelation(relation));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/relations/spouse", (req, res, next) => {
  try {
    const parsed = deleteSpouseSchema.parse({
      personAId: req.query.personAId,
      personBId: req.query.personBId,
    });

    const isSorted = parsed.personAId < parsed.personBId;
    const personAId = isSorted ? parsed.personAId : parsed.personBId;
    const personBId = isSorted ? parsed.personBId : parsed.personAId;

    const result = db
      .prepare("DELETE FROM spouse_relations WHERE person_a_id = ? AND person_b_id = ?")
      .run(personAId, personBId);

    if (result.changes === 0) {
      res.status(404).json({ message: "Requested record was not found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: "Validation failed", errors: error.flatten() });
    return;
  }

  if (isSqliteConstraintError(error)) {
    if (error.message.includes("UNIQUE")) {
      res.status(409).json({ message: "That record already exists." });
      return;
    }

    res.status(400).json({ message: "Database constraint failed." });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

const isSqliteConstraintError = (
  error: unknown,
): error is { code: string; message: string } => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;

  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT") && typeof message === "string";
};

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  db.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
