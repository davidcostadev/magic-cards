import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { cardResponseSchema } from '../../cards/dto/card.dto';

export const createReviewSchema = z.object({
  cardId: z.string().min(1),
  quality: z.number().int().min(1).max(5),
  timeSpent: z.number().int().min(0),
  wasHintUsed: z.boolean(),
});

export const reviewQueueQuerySchema = z.object({
  subject: z.string().min(1).optional(),
});

export const cardProgressResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  cardId: z.string(),
  interval: z.number(),
  easeFactor: z.number(),
  repetitions: z.number(),
  nextReviewDate: z.string(),
  lastReviewDate: z.string().nullable(),
  status: z.enum(['new', 'learning', 'reviewing', 'mastered']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reviewQueueResponseSchema = z.object({
  due: z.array(cardResponseSchema),
  new: z.array(cardResponseSchema),
  total: z.number(),
});

export class CreateReviewDto extends createZodDto(createReviewSchema) {}
export class ReviewQueueQueryDto extends createZodDto(reviewQueueQuerySchema) {}
export class CardProgressResponseDto extends createZodDto(cardProgressResponseSchema) {}
export class ReviewQueueResponseDto extends createZodDto(reviewQueueResponseSchema) {}

export type CardProgressResponse = z.infer<typeof cardProgressResponseSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
