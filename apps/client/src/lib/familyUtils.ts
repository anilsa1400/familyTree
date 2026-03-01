import { FamilyGraph, Person } from "../types/family";

export type FamilyGroup = {
  key: string;
  familyName: string;
  members: Person[];
};

export const displayName = (person: Person) => `${person.firstName} ${person.lastName}`.trim();

export const familyNameFromLastName = (lastName: string | null | undefined) => {
  const trimmed = (lastName ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Unknown";
};

export const buildFamilyNameMap = (graph: FamilyGraph): Map<string, string> => {
  const personById = new Map<string, Person>();
  graph.persons.forEach((person) => {
    personById.set(person.id, person);
  });

  const parentIdsByChild = new Map<string, string[]>();
  graph.parentChildRelations.forEach((relation) => {
    const parentIds = parentIdsByChild.get(relation.childId) ?? [];
    parentIds.push(relation.parentId);
    parentIdsByChild.set(relation.childId, parentIds);
  });

  const spouseRelationsByPerson = new Map<string, FamilyGraph["spouseRelations"]>();
  graph.spouseRelations.forEach((relation) => {
    const listA = spouseRelationsByPerson.get(relation.personAId) ?? [];
    listA.push(relation);
    spouseRelationsByPerson.set(relation.personAId, listA);

    const listB = spouseRelationsByPerson.get(relation.personBId) ?? [];
    listB.push(relation);
    spouseRelationsByPerson.set(relation.personBId, listB);
  });

  const birthFamilyMemo = new Map<string, string>();
  const resolvingBirth = new Set<string>();

  const resolveBirthFamily = (personId: string): string => {
    if (birthFamilyMemo.has(personId)) {
      return birthFamilyMemo.get(personId) ?? "Unknown";
    }

    const self = personById.get(personId);
    if (!self) {
      return "Unknown";
    }

    if (resolvingBirth.has(personId)) {
      return familyNameFromLastName(self.lastName);
    }

    resolvingBirth.add(personId);

    const parentIds = parentIdsByChild.get(personId) ?? [];
    let familyName = familyNameFromLastName(self.lastName);

    if (parentIds.length > 0) {
      const fatherId = parentIds.find((parentId) => personById.get(parentId)?.gender === "MALE");
      const motherId = parentIds.find((parentId) => personById.get(parentId)?.gender === "FEMALE");
      const lineageParentId = fatherId ?? motherId ?? parentIds[0];

      if (lineageParentId) {
        familyName = resolveBirthFamily(lineageParentId);
      }
    }

    birthFamilyMemo.set(personId, familyName);
    resolvingBirth.delete(personId);
    return familyName;
  };

  const resolveHusbandIdForPerson = (personId: string): string | null => {
    const relations = (spouseRelationsByPerson.get(personId) ?? []).filter((relation) => !relation.divorcedAt);
    if (relations.length === 0) {
      return null;
    }

    const normalized = [...relations].sort((left, right) => {
      const leftDate = left.marriedAt ?? left.createdAt;
      const rightDate = right.marriedAt ?? right.createdAt;
      return rightDate.localeCompare(leftDate);
    });

    for (const relation of normalized) {
      const spouseId = relation.personAId === personId ? relation.personBId : relation.personAId;
      const spouse = personById.get(spouseId);
      if (spouse?.gender === "MALE") {
        return spouseId;
      }
    }

    return null;
  };

  const finalFamilyMap = new Map<string, string>();

  graph.persons.forEach((person) => {
    let familyName = resolveBirthFamily(person.id);

    if (person.gender === "FEMALE") {
      const husbandId = resolveHusbandIdForPerson(person.id);
      if (husbandId) {
        familyName = resolveBirthFamily(husbandId);
      }
    }

    finalFamilyMap.set(person.id, familyName);
  });

  return finalFamilyMap;
};

export const groupMembersByFamilyName = (
  persons: Person[],
  familyNameByPersonId: Map<string, string>,
): FamilyGroup[] => {
  const groups = new Map<string, FamilyGroup>();

  persons.forEach((person) => {
    const familyName = familyNameByPersonId.get(person.id) ?? familyNameFromLastName(person.lastName);
    const key = familyName.toLowerCase();
    const current = groups.get(key);

    if (current) {
      current.members.push(person);
      return;
    }

    groups.set(key, {
      key,
      familyName,
      members: [person],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      members: [...group.members].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    }))
    .sort((a, b) => a.familyName.localeCompare(b.familyName));
};

export const formatDate = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

export const memberLifeLabel = (person: Person) => {
  const birthDate = formatDate(person.dateOfBirth);
  const deathDate = formatDate(person.dateOfDeath);

  if (birthDate && deathDate) {
    return `${birthDate} - ${deathDate}`;
  }

  if (birthDate) {
    return `Born ${birthDate}`;
  }

  if (deathDate) {
    return `Died ${deathDate}`;
  }

  return "Dates not set";
};

export const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const initialsFromPerson = (person: Person) => {
  const first = person.firstName.trim().charAt(0).toUpperCase();
  const last = person.lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`.trim();
  return initials || "M";
};
