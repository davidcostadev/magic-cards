import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CARD_TYPES } from '../../../db/schema';
import { cardResponseSchema, cardTranslationsSchema } from '../../cards/dto/card.dto';

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

/**
 * A "check" of an auto-graded answer — used by the in-session short loop to re-grade a card the
 * learner is re-practising. Same `response` shape as a real review, but the endpoint only grades
 * it and returns feedback: nothing is scheduled or recorded (the first attempt already did that).
 */
export const checkReviewSchema = z.object({
  cardId: z.string().min(1),
  response: reviewResponseSchema,
});

export const reviewQueueQuerySchema = z.object({
  subject: z.string().min(1).optional(),
  // Optionally restrict the session to a single card type (e.g. only quizzes).
  type: z.enum(CARD_TYPES).optional(),
  // Review-ahead: relax the due gate so already-seen, not-yet-due cards can be studied.
  // Query strings arrive as text, so coerce the literal "true" (booleans pass through too).
  ahead: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});

/**
 * Request a quiz "eliminate" hint: the server greys out one wrong choice. The client sends the
 * ids it has already eliminated; correctness is never sent to the client, so elimination must
 * be decided server-side (it knows which choices are wrong).
 */
export const eliminateChoiceSchema = z.object({
  cardId: z.string().min(1),
  eliminatedChoiceIds: z.array(z.string()).default([]),
});

/** `choiceId` is the next wrong choice to disable, or `null` once only two choices remain. */
export const eliminateChoiceResponseSchema = z.object({
  choiceId: z.string().nullable(),
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
  // Per-language alternates of the question/answer, shipped only here (post-answer, so no spoiler).
  // The client picks the learner's card language for the explanation, falling back to `explanation`.
  translations: cardTranslationsSchema.optional(),
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
  // Studyable right now (new or overdue).
  total: z.number(),
  byType: cardTypeCountsSchema,
  // The entire visible pool, regardless of schedule — what review-ahead can draw from.
  reviewableTotal: z.number(),
  reviewableByType: cardTypeCountsSchema,
});

export class CreateReviewDto extends createZodDto(createReviewSchema) {}
export class CheckReviewDto extends createZodDto(checkReviewSchema) {}
/** A grade-only check returns just the grading feedback — same shape as a review's `grade`. */
export class CheckReviewResponseDto extends createZodDto(gradeResultSchema) {}
export class EliminateChoiceDto extends createZodDto(eliminateChoiceSchema) {}
export class EliminateChoiceResponseDto extends createZodDto(eliminateChoiceResponseSchema) {}
export class ReviewQueueQueryDto extends createZodDto(reviewQueueQuerySchema) {}
export class CardProgressResponseDto extends createZodDto(cardProgressResponseSchema) {}
export class SubmitReviewResponseDto extends createZodDto(submitReviewResponseSchema) {}
export class ReviewQueueResponseDto extends createZodDto(reviewQueueResponseSchema) {}
export class ReviewQueueCountsResponseDto extends createZodDto(reviewQueueCountsResponseSchema) {}

export type CardProgressResponse = z.infer<typeof cardProgressResponseSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type ReviewQueueCountsResponse = z.infer<typeof reviewQueueCountsResponseSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CheckReviewInput = z.infer<typeof checkReviewSchema>;
export type EliminateChoiceInput = z.infer<typeof eliminateChoiceSchema>;
export type EliminateChoiceResult = z.infer<typeof eliminateChoiceResponseSchema>;
export type GradeResult = z.infer<typeof gradeResultSchema>;
export type SubmitReviewResult = z.infer<typeof submitReviewResponseSchema>;
