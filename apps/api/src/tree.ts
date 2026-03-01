import {
  FamilyRecord,
  ParentChildRelationRecord,
  PersonRecord,
  SpouseRelationRecord,
} from "./types";

export type SerializedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  gender: PersonRecord["gender"];
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedParentChildRelation = {
  id: string;
  parentId: string;
  childId: string;
  relationType: ParentChildRelationRecord["relation_type"];
  createdAt: string;
};

export type SerializedSpouseRelation = {
  id: string;
  personAId: string;
  personBId: string;
  marriedAt: string | null;
  divorcedAt: string | null;
  createdAt: string;
};

export type FamilyGraph = {
  families: SerializedFamily[];
  persons: SerializedPerson[];
  parentChildRelations: SerializedParentChildRelation[];
  spouseRelations: SerializedSpouseRelation[];
};

export type SerializedFamily = {
  id: string;
  name: string;
  motto: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export const serializePerson = (person: PersonRecord): SerializedPerson => ({
  id: person.id,
  firstName: person.first_name,
  lastName: person.last_name,
  gender: person.gender,
  dateOfBirth: person.date_of_birth,
  dateOfDeath: person.date_of_death,
  photoUrl: person.photo_url,
  notes: person.notes,
  createdAt: person.created_at,
  updatedAt: person.updated_at,
});

export const serializeParentChild = (
  relation: ParentChildRelationRecord,
): SerializedParentChildRelation => ({
  id: relation.id,
  parentId: relation.parent_id,
  childId: relation.child_id,
  relationType: relation.relation_type,
  createdAt: relation.created_at,
});

export const serializeSpouseRelation = (relation: SpouseRelationRecord): SerializedSpouseRelation => ({
  id: relation.id,
  personAId: relation.person_a_id,
  personBId: relation.person_b_id,
  marriedAt: relation.married_at,
  divorcedAt: relation.divorced_at,
  createdAt: relation.created_at,
});

export const serializeFamily = (family: FamilyRecord): SerializedFamily => ({
  id: family.id,
  name: family.name,
  motto: family.motto,
  description: family.description,
  createdAt: family.created_at,
  updatedAt: family.updated_at,
});
