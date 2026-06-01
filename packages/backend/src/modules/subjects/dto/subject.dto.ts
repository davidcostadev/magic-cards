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
});

export class CreateSubjectDto extends createZodDto(createSubjectSchema) {}
export class UpdateSubjectDto extends createZodDto(updateSubjectSchema) {}
export class SubjectResponseDto extends createZodDto(subjectResponseSchema) {}
export class SubjectListDto extends createZodDto(listResponseSchema(subjectResponseSchema)) {}
export class SubjectStatsDto extends createZodDto(subjectStatsSchema) {}

export type SubjectResponse = z.infer<typeof subjectResponseSchema>;
export type SubjectStats = z.infer<typeof subjectStatsSchema>;
