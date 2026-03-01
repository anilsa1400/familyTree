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

const insertParentChild = db.prepare(
  "INSERT INTO parent_child_relations (id, parent_id, child_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)",
);

const insertSpouse = db.prepare(
  `INSERT INTO spouse_relations (
    id,
    person_a_id,
    person_b_id,
    married_at,
    divorced_at,
    created_at
  ) VALUES (?, ?, ?, ?, NULL, ?)`,
);

const createParentChild = (parentId: string, childId: string, relationType = "BIOLOGICAL") => {
  insertParentChild.run(randomUUID(), parentId, childId, relationType, timestamp());
};

const createSpouse = (personOneId: string, personTwoId: string, marriedAt: string) => {
  const [personAId, personBId] =
    personOneId < personTwoId ? [personOneId, personTwoId] : [personTwoId, personOneId];

  insertSpouse.run(randomUUID(), personAId, personBId, marriedAt, timestamp());
};

type PersonSeed = {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
};

type DescendantStep = {
  child: PersonSeed;
  partner?: PersonSeed;
  marriedAt?: string;
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
  const claireId = createPerson("Claire", "Johnson", "FEMALE", "1991-12-09T00:00:00.000Z");

  createSpouse(robertId, annaId, "1983-01-15T00:00:00.000Z");
  createSpouse(michaelId, claireId, "2015-06-12T00:00:00.000Z");

  createParentChild(robertId, michaelId);
  createParentChild(annaId, michaelId);
  createParentChild(robertId, emilyId);
  createParentChild(annaId, emilyId);
  createParentChild(michaelId, sophiaId);
  createParentChild(claireId, sophiaId);

  // Generation chain from Emily (gen-2) down to gen-10.
  const descendantSteps: DescendantStep[] = [
    {
      child: { firstName: "Chloe", lastName: "Clark", gender: "FEMALE", dateOfBirth: "2016-05-14T00:00:00.000Z" },
      partner: { firstName: "Aarav", lastName: "Patel", gender: "MALE", dateOfBirth: "2015-01-20T00:00:00.000Z" },
      marriedAt: "2036-03-15T00:00:00.000Z",
    },
    {
      child: { firstName: "Riya", lastName: "Patel", gender: "FEMALE", dateOfBirth: "2038-08-10T00:00:00.000Z" },
      partner: { firstName: "Noah", lastName: "Kim", gender: "MALE", dateOfBirth: "2036-11-06T00:00:00.000Z" },
      marriedAt: "2058-02-21T00:00:00.000Z",
    },
    {
      child: { firstName: "Aria", lastName: "Kim", gender: "FEMALE", dateOfBirth: "2060-09-30T00:00:00.000Z" },
      partner: { firstName: "Liam", lastName: "Chen", gender: "MALE", dateOfBirth: "2058-04-03T00:00:00.000Z" },
      marriedAt: "2080-01-17T00:00:00.000Z",
    },
    {
      child: { firstName: "Mira", lastName: "Chen", gender: "FEMALE", dateOfBirth: "2082-12-11T00:00:00.000Z" },
      partner: { firstName: "Ethan", lastName: "Reed", gender: "MALE", dateOfBirth: "2080-05-09T00:00:00.000Z" },
      marriedAt: "2102-07-12T00:00:00.000Z",
    },
    {
      child: { firstName: "Zara", lastName: "Reed", gender: "FEMALE", dateOfBirth: "2104-06-23T00:00:00.000Z" },
      partner: { firstName: "Owen", lastName: "Blake", gender: "MALE", dateOfBirth: "2102-02-14T00:00:00.000Z" },
      marriedAt: "2124-09-19T00:00:00.000Z",
    },
    {
      child: { firstName: "Nia", lastName: "Blake", gender: "FEMALE", dateOfBirth: "2126-03-05T00:00:00.000Z" },
      partner: { firstName: "Kai", lastName: "Turner", gender: "MALE", dateOfBirth: "2124-12-01T00:00:00.000Z" },
      marriedAt: "2146-10-28T00:00:00.000Z",
    },
    {
      child: { firstName: "Isha", lastName: "Turner", gender: "FEMALE", dateOfBirth: "2148-01-26T00:00:00.000Z" },
      partner: { firstName: "Leo", lastName: "Walker", gender: "MALE", dateOfBirth: "2146-07-18T00:00:00.000Z" },
      marriedAt: "2168-06-30T00:00:00.000Z",
    },
    {
      child: { firstName: "Ava", lastName: "Walker", gender: "FEMALE", dateOfBirth: "2170-04-08T00:00:00.000Z" },
    },
  ];

  const emilyPartnerId = createPerson("Daniel", "Clark", "MALE", "1990-10-03T00:00:00.000Z");
  createSpouse(emilyId, emilyPartnerId, "2014-06-21T00:00:00.000Z");

  let currentParentId = emilyId;
  let currentPartnerId = emilyPartnerId;

  descendantSteps.forEach((step) => {
    const childId = createPerson(
      step.child.firstName,
      step.child.lastName,
      step.child.gender,
      step.child.dateOfBirth,
    );

    createParentChild(currentParentId, childId);
    createParentChild(currentPartnerId, childId);

    if (!step.partner) {
      return;
    }

    const partnerId = createPerson(
      step.partner.firstName,
      step.partner.lastName,
      step.partner.gender,
      step.partner.dateOfBirth,
    );

    createSpouse(childId, partnerId, step.marriedAt ?? timestamp());
    currentParentId = childId;
    currentPartnerId = partnerId;
  });

  console.log("Seed complete");
};

run();
