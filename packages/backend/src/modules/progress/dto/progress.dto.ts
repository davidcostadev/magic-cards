import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CARD_TYPES } from '../../../db/schema';

const MAX_EXPLICIT_CARDS = 500;

/**
 * Which of the learner's studied cards to send back to "never studied". Filters combine with AND,
 * so `{ subject, type }` resets one card type inside one subject. At least one filter is required —
 * `all: true` is the explicit opt-in for wiping everything, so an empty body can never do it by
 * accident (see `ProgressService.reset`).
 */
export const resetProgressSchema = z.object({
  subject: z.string().min(1).optional(),
  type: z.enum(CARD_TYPES).optional(),
  cards: z.array(z.string().min(1)).min(1).max(MAX_EXPLICIT_CARDS).optional(),
  // Literal `true` (not a plain boolean): `all: false` shouldn't read as a filter.
  all: z.literal(true).optional(),
});

/** What the reset removed: scheduling rows, and the review log entries behind the statistics. */
export const resetProgressResponseSchema = z.object({
  cardsReset: z.number(),
  reviewsDeleted: z.number(),
});

export class ResetProgressDto extends createZodDto(resetProgressSchema) {}
export class ResetProgressResponseDto extends createZodDto(resetProgressResponseSchema) {}

export type ResetProgressInput = z.infer<typeof resetProgressSchema>;
export type ResetProgressResult = z.infer<typeof resetProgressResponseSchema>;
