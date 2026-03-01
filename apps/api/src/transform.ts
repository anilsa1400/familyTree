import { PersonInput, SpouseInput } from "./schema";

const normalizeDate = (value: string | null | undefined): string | null => {
  if (!value || value.trim() === "") {
    return null;
  }

  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
};

export const toPersonDbInput = (input: PersonInput) => ({
  firstName: input.firstName.trim(),
  lastName: input.lastName.trim(),
  gender: input.gender ?? null,
  dateOfBirth: normalizeDate(input.dateOfBirth ?? null),
  dateOfDeath: normalizeDate(input.dateOfDeath ?? null),
  photoUrl: input.photoUrl?.trim() ? input.photoUrl.trim() : null,
  notes: input.notes?.trim() ? input.notes.trim() : null,
});

export const toSpouseDbInput = (input: SpouseInput) => {
  const isSorted = input.personAId < input.personBId;

  return {
    personAId: isSorted ? input.personAId : input.personBId,
    personBId: isSorted ? input.personBId : input.personAId,
    marriedAt: normalizeDate(input.marriedAt ?? null),
    divorcedAt: normalizeDate(input.divorcedAt ?? null),
  };
};
