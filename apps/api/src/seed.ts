import { randomUUID } from "crypto";
import { db } from "./db";

const timestamp = () => new Date().toISOString();

const createPerson = (firstName: string, lastName: string, gender: string, dateOfBirth: string) => {
  const id = randomUUID();
  const now = timestamp();

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
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(id, firstName, lastName, gender, dateOfBirth, now, now);

  return id;
};

const run = () => {
  db.prepare("DELETE FROM spouse_relations").run();
  db.prepare("DELETE FROM parent_child_relations").run();
  db.prepare("DELETE FROM persons").run();

  const robertId = createPerson("Robert", "Johnson", "MALE", "1960-05-10T00:00:00.000Z");
  const annaId = createPerson("Anna", "Johnson", "FEMALE", "1963-09-04T00:00:00.000Z");
  const michaelId = createPerson("Michael", "Johnson", "MALE", "1989-02-13T00:00:00.000Z");
  const emilyId = createPerson("Emily", "Johnson", "FEMALE", "1992-06-28T00:00:00.000Z");
  const sophiaId = createPerson("Sophia", "Johnson", "FEMALE", "2018-11-01T00:00:00.000Z");

  const spouseAId = annaId < robertId ? annaId : robertId;
  const spouseBId = annaId < robertId ? robertId : annaId;

  db.prepare(
    `INSERT INTO spouse_relations (
      id,
      person_a_id,
      person_b_id,
      married_at,
      divorced_at,
      created_at
    ) VALUES (?, ?, ?, ?, NULL, ?)`,
  ).run(randomUUID(), spouseAId, spouseBId, "1983-01-15T00:00:00.000Z", timestamp());

  const relations = [
    [robertId, michaelId],
    [annaId, michaelId],
    [robertId, emilyId],
    [annaId, emilyId],
    [michaelId, sophiaId],
  ];

  const insertRelation = db.prepare(
    "INSERT INTO parent_child_relations (id, parent_id, child_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)",
  );

  relations.forEach(([parentId, childId]) => {
    insertRelation.run(randomUUID(), parentId, childId, "BIOLOGICAL", timestamp());
  });

  console.log("Seed complete");
};

run();
