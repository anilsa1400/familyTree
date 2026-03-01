export type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "OTHER";

export type ParentType = "BIOLOGICAL" | "ADOPTIVE" | "STEP" | "GUARDIAN";

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParentChildRelation = {
  id: string;
  parentId: string;
  childId: string;
  relationType: ParentType;
  createdAt: string;
};

export type SpouseRelation = {
  id: string;
  personAId: string;
  personBId: string;
  marriedAt: string | null;
  divorcedAt: string | null;
  createdAt: string;
};

export type Family = {
  id: string;
  name: string;
  motto: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyGraph = {
  families: Family[];
  persons: Person[];
  parentChildRelations: ParentChildRelation[];
  spouseRelations: SpouseRelation[];
};

export type PersonInput = {
  firstName: string;
  lastName: string;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
};

export type ParentChildInput = {
  parentId: string;
  childId: string;
  relationType: ParentType;
};

export type SpouseInput = {
  personAId: string;
  personBId: string;
  marriedAt?: string | null;
  divorcedAt?: string | null;
};

export type FamilyInput = {
  name: string;
  motto?: string | null;
  description?: string | null;
};
