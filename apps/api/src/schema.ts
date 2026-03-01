import { z } from "zod";
import { genderValues, parentTypeValues } from "./types";

const isoDate = z
  .string()
  .trim()
  .datetime({ offset: true })
  .or(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/));

export const personInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  gender: z.enum(genderValues).optional().nullable(),
  dateOfBirth: isoDate.optional().nullable(),
  dateOfDeath: isoDate.optional().nullable(),
  photoUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const parentChildInputSchema = z.object({
  parentId: z.string().trim().min(1),
  childId: z.string().trim().min(1),
  relationType: z.enum(parentTypeValues).default("BIOLOGICAL"),
});

export const spouseInputSchema = z.object({
  personAId: z.string().trim().min(1),
  personBId: z.string().trim().min(1),
  marriedAt: isoDate.optional().nullable(),
  divorcedAt: isoDate.optional().nullable(),
});

export const deleteParentChildSchema = z.object({
  parentId: z.string().trim().min(1),
  childId: z.string().trim().min(1),
});

export const deleteSpouseSchema = z.object({
  personAId: z.string().trim().min(1),
  personBId: z.string().trim().min(1),
});

export type PersonInput = z.infer<typeof personInputSchema>;
export type ParentChildInput = z.infer<typeof parentChildInputSchema>;
export type SpouseInput = z.infer<typeof spouseInputSchema>;
