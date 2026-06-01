import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CARD_TYPES } from '../../../db/schema';
import { cardResponseSchema } from '../../cards/dto/card.dto';

const matchPairSchema = z.object({ left: z.string().min(1), right: z.string().min(1) });

/**
 * The learner's answer for an auto-graded card; discriminated by the card's type.
 * Fields are allowed to be empty so a timed-out / skipped attempt can be submitted and
 * graded as incorrect (a lapse), rather than rejected by validation.
 */
const reviewResponseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quiz'), choiceId: z.string() }),
  z.object({ type: z.literal('type-answer'), text: z.string() }),
  z.object({ type: z.literal('match'), pairs: z.array(matchPairSchema) }),
]);

/**
 * Exactly one of `quality` / `response`:
 * - `open` cards are self-assessed → the client sends `quality` (1–5).
 * - quiz / type-answer / match are graded server-side → the client sends its `response`.
 */
export const createReviewSchema = z
  .object({
    cardId: z.string().min(1),
    quality: z.number().int().min(1).max(5).optional(),
    response: reviewResponseSchema.optional(),
    timeSpent: z.number().int().min(0),
    wasHintUsed: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if ((data.quality == null) === (data.response == null)) {
      ctx.addIssue({ code: 'custom', path: ['quality'], message: 'reviews.qualityOrResponse' });
    }
  });

export const reviewQueueQuerySchema = z.object({
  subject: z.string().min(1).optional(),
  // Optionally restrict the session to a single card type (e.g. only quizzes).
  type: z.enum(CARD_TYPES).optional(),
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

/** Grading feedback returned for auto-graded cards (absent for self-assessed `open` cards). */
export const gradeResultSchema = z.object({
  correct: z.boolean(),
  explanation: z.string(), // the card's Markdown answer/explanation, revealed after grading
  correctChoiceId: z.string().optional(), // quiz
  correctText: z.string().optional(), // type-answer
  correctPairs: z.array(matchPairSchema).optional(), // match
});

export const submitReviewResponseSchema = z.object({
  progress: cardProgressResponseSchema,
  grade: gradeResultSchema.optional(),
});

export const reviewQueueResponseSchema = z.object({
  due: z.array(cardResponseSchema),
  new: z.array(cardResponseSchema),
  total: z.number(),
});

/** How many visible cards of each type exist (for the "choose what to study" screen). */
export const cardTypeCountsSchema = z.object({
  open: z.number(),
  quiz: z.number(),
  'type-answer': z.number(),
  match: z.number(),
});

export const reviewQueueCountsResponseSchema = z.object({
  total: z.number(),
  byType: cardTypeCountsSchema,
});

export class CreateReviewDto extends createZodDto(createReviewSchema) {}
export class ReviewQueueQueryDto extends createZodDto(reviewQueueQuerySchema) {}
export class CardProgressResponseDto extends createZodDto(cardProgressResponseSchema) {}
export class SubmitReviewResponseDto extends createZodDto(submitReviewResponseSchema) {}
export class ReviewQueueResponseDto extends createZodDto(reviewQueueResponseSchema) {}
export class ReviewQueueCountsResponseDto extends createZodDto(reviewQueueCountsResponseSchema) {}

export type CardProgressResponse = z.infer<typeof cardProgressResponseSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type ReviewQueueCountsResponse = z.infer<typeof reviewQueueCountsResponseSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type GradeResult = z.infer<typeof gradeResultSchema>;
export type SubmitReviewResult = z.infer<typeof submitReviewResponseSchema>;
