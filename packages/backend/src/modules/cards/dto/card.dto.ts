import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationQuerySchema } from '../../../common/pagination';

export const createCardSchema = z.object({
  subjectId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  hints: z.array(z.string()).max(10).optional(),
  tags: z.array(z.string()).max(20).optional(),
});

// A card cannot move between subjects, so subjectId is not updatable.
export const updateCardSchema = createCardSchema.omit({ subjectId: true }).partial();

export const cardListQuerySchema = paginationQuerySchema.extend({
  subject: z.string().min(1),
});

export const cardResponseSchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  question: z.string(),
  answer: z.string(),
  hints: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class CreateCardDto extends createZodDto(createCardSchema) {}
export class UpdateCardDto extends createZodDto(updateCardSchema) {}
export class CardListQueryDto extends createZodDto(cardListQuerySchema) {}
export class CardResponseDto extends createZodDto(cardResponseSchema) {}

export type CardResponse = z.infer<typeof cardResponseSchema>;
export type CardListQuery = z.infer<typeof cardListQuerySchema>;
