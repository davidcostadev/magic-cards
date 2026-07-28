import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { listResponseSchema } from '../../../common/pagination';

export const createSubjectSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  color: z.string().max(32).optional(),
  icon: z.string().max(64).optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const subjectResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  isPublic: z.boolean(),
  cardCount: z.number(),
  // Whether the current user has this subject in their list ("My Subjects" grid filters on it).
  selected: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const subjectStatsSchema = z.object({
  totalCards: z.number(),
  new: z.number(),
  learning: z.number(),
  reviewing: z.number(),
  mastered: z.number(),
  due: z.number(),
  totalReviews: z.number(), // every review the user has done in this subject
  accuracy: z.number(), // 0-100 (reviews graded >= 3), 0 before any study
  avgEaseFactor: z.number().nullable(), // mean SM-2 ease across studied cards; null before any study
});

/** Per-subject study progress for the list view: how much is reviewed vs still to study. */
export const subjectProgressSchema = z.object({
  subjectId: z.string(),
  total: z.number(), // every card in the subject
  reviewed: z.number(), // cards the user has studied at least once
  due: z.number(), // cards studyable now (overdue + never-reviewed)
  mastered: z.number(), // cards whose SM-2 state reached "mastered"
  totalReviews: z.number(), // every review the user has done in this subject
  accuracy: z.number(), // 0-100 (reviews graded >= 3), 0 before any study
  avgEaseFactor: z.number().nullable(), // mean SM-2 ease across studied cards; null before any study
});

/**
 * The current user's performance on one card of a subject — the same shape as `/cards/:id/stats`
 * plus the `cardId` it belongs to, fetched in bulk so the subject view can score and sort a whole
 * deck without an N+1. Cards the user has never studied are omitted (no row at all).
 */
export const subjectCardStatsSchema = z.object({
  cardId: z.string(),
  totalReviews: z.number(),
  correctCount: z.number(),
  incorrectCount: z.number(),
  accuracy: z.number(), // 0-100, 0 when never reviewed
  avgTimeMs: z.number(),
  hintedCount: z.number(),
  easeFactor: z.number().nullable(),
  interval: z.number().nullable(),
  repetitions: z.number().nullable(),
  status: z.enum(['new', 'learning', 'reviewing', 'mastered']).nullable(),
  lastReviewDate: z.string().nullable(),
  nextReviewDate: z.string().nullable(),
});

export const subjectCardStatsListSchema = z.object({
  data: z.array(subjectCardStatsSchema),
});

export const subjectProgressListSchema = z.object({
  data: z.array(subjectProgressSchema),
});

export class CreateSubjectDto extends createZodDto(createSubjectSchema) {}
export class UpdateSubjectDto extends createZodDto(updateSubjectSchema) {}
export class SubjectResponseDto extends createZodDto(subjectResponseSchema) {}
export class SubjectListDto extends createZodDto(listResponseSchema(subjectResponseSchema)) {}
export class SubjectStatsDto extends createZodDto(subjectStatsSchema) {}
export class SubjectProgressListDto extends createZodDto(subjectProgressListSchema) {}
export class SubjectCardStatsListDto extends createZodDto(subjectCardStatsListSchema) {}

export type SubjectResponse = z.infer<typeof subjectResponseSchema>;
export type SubjectStats = z.infer<typeof subjectStatsSchema>;
export type SubjectProgress = z.infer<typeof subjectProgressSchema>;
export type SubjectCardStats = z.infer<typeof subjectCardStatsSchema>;
