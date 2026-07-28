import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { listResponseSchema, paginationQuerySchema } from '../../../common/pagination';
import { CARD_LANGUAGES, CARD_TYPES } from '../../../db/schema';
import { findMermaidFenceError } from '../mermaid-fence';

const choiceInputSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const matchPairSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
});

/** Alternate-language versions of a card's question/answer, keyed by language code. */
const cardTranslationSchema = z.object({
  question: z.string().min(1),
  answer: z.string(),
});
// Explicit per-language keys (kept in sync with CARD_LANGUAGES) so the inferred type is PARTIAL —
// a card may carry only some languages. A plain z.record(enum, …) would require every key.
export const cardTranslationsSchema = z.object({
  en: cardTranslationSchema.optional(),
  pt: cardTranslationSchema.optional(),
});

const MIN_CHOICES = 2;
const MAX_CHOICES = 8;
const MIN_PAIRS = 2;
const MAX_PAIRS = 12;

/** Per-type rules. `type` defaults to `open`, so legacy open-card payloads stay valid. */
const cardInputShape = {
  question: z.string().min(1),
  // Content language of the card; defaults to 'en' at the DB level when omitted.
  language: z.enum(CARD_LANGUAGES).optional(),
  // Alternate-language versions (e.g. a `pt` entry on an `en` card) — viewed via the modal toggle.
  translations: cardTranslationsSchema.optional(),
  // open/quiz/type-answer: the answer/explanation. match: optional explanation.
  answer: z.string().optional(),
  choices: z.array(choiceInputSchema).max(MAX_CHOICES).optional(), // quiz
  shortAnswer: z.string().optional(), // type-answer
  matchPairs: z.array(matchPairSchema).max(MAX_PAIRS).optional(), // match
  hints: z.array(z.string()).max(10).optional(),
  tags: z.array(z.string()).max(20).optional(),
};

/** Adds the discriminator-driven requirements that a flat object schema can't express alone. */
function refineCardByType(
  data: {
    type: string;
    question?: string;
    answer?: string;
    choices?: unknown[];
    shortAnswer?: string;
    matchPairs?: unknown[];
    translations?: Record<string, { question?: string; answer?: string } | undefined>;
  },
  ctx: z.RefinementCtx
): void {
  const fail = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });
  const hasText = (v?: string) => typeof v === 'string' && v.trim().length > 0;

  // A ```mermaid fence whose diagram type is missing or misspelled renders as a fallback source
  // block, so catch it at author time instead of letting a learner find it. See mermaid-fence.ts
  // for exactly how shallow this check is.
  const checkDiagrams = (path: string, markdown?: string) => {
    if (!hasText(markdown)) return;
    const error = findMermaidFenceError(markdown as string);
    if (error) fail(path, error);
  };
  checkDiagrams('question', data.question);
  checkDiagrams('answer', data.answer);
  for (const [lang, t] of Object.entries(data.translations ?? {})) {
    checkDiagrams(`translations.${lang}.question`, t?.question);
    checkDiagrams(`translations.${lang}.answer`, t?.answer);
  }

  if (data.type === 'open' || data.type === 'quiz' || data.type === 'type-answer') {
    if (!hasText(data.answer)) fail('answer', 'cards.answerRequired');
  }
  if (data.type === 'quiz') {
    const choices = (data.choices ?? []) as { isCorrect?: boolean }[];
    if (choices.length < MIN_CHOICES) fail('choices', 'cards.quizNeedsChoices');
    else if (choices.filter((c) => c.isCorrect).length !== 1)
      fail('choices', 'cards.quizNeedsOneCorrect');
  }
  if (data.type === 'type-answer' && !hasText(data.shortAnswer)) {
    fail('shortAnswer', 'cards.shortAnswerRequired');
  }
  if (data.type === 'match') {
    const pairs = (data.matchPairs ?? []) as { right?: string }[];
    if (pairs.length < MIN_PAIRS) {
      fail('matchPairs', 'cards.matchNeedsPairs');
    } else {
      // Right-hand values must be unique: the matching UI identifies tiles by their text, so
      // duplicate rights make a card unsolvable (two identical tiles can't both be matched).
      const rights = pairs.map((p) => p.right);
      if (new Set(rights).size !== rights.length) {
        fail('matchPairs', 'cards.matchRightsUnique');
      }
    }
  }
}

export const createCardSchema = z
  .object({
    subjectId: z.string().min(1),
    type: z.enum(CARD_TYPES).default('open'),
    ...cardInputShape,
  })
  .superRefine(refineCardByType);

// A card cannot change subject or type after creation; everything else is editable.
export const updateCardSchema = z.object(cardInputShape).partial();

export const cardListQuerySchema = paginationQuerySchema.extend({
  subject: z.string().min(1),
});

const choiceResponseSchema = z.object({
  id: z.string(),
  text: z.string(),
  // Present only for the owner (authoring). Stripped before a learner studies the card.
  isCorrect: z.boolean().optional(),
});

/**
 * One permissive shape for every card type. The type-specific fields are present per `type`,
 * and the answer-bearing fields (`isCorrect`, `shortAnswer`, `matchPairs`) are omitted for
 * non-owners — a learner instead gets the shuffled `matchItems` for the match interaction.
 */
export const cardResponseSchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  type: z.enum(CARD_TYPES),
  language: z.enum(CARD_LANGUAGES),
  question: z.string(),
  answer: z.string(),
  translations: cardTranslationsSchema.optional(),
  hints: z.array(z.string()),
  tags: z.array(z.string()),
  choices: z.array(choiceResponseSchema).optional(), // quiz
  shortAnswer: z.string().optional(), // type-answer (owner only)
  matchPairs: z.array(matchPairSchema).optional(), // match (owner only) — full pairing
  matchItems: z // match (learner) — shuffled, no pairing revealed
    .object({ lefts: z.array(z.string()), rights: z.array(z.string()) })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Per-card performance for the current user ("nerd stats"). The aggregate counts come from
 * `review_history`; the SM-2 fields come from `card_progress` and are null until the card has
 * been reviewed at least once. Never reveals the answer — only the learner's own performance.
 */
export const cardStatsResponseSchema = z.object({
  totalReviews: z.number(),
  correctCount: z.number(), // reviews graded quality ≥ 3
  incorrectCount: z.number(), // reviews graded quality < 3
  accuracy: z.number(), // 0–100 (correct / total), 0 when never reviewed
  avgTimeMs: z.number(), // mean time_spent across reviews, 0 when never reviewed
  hintedCount: z.number(), // reviews where a hint was revealed
  easeFactor: z.number().nullable(),
  interval: z.number().nullable(),
  repetitions: z.number().nullable(),
  status: z.enum(['new', 'learning', 'reviewing', 'mastered']).nullable(),
  lastReviewDate: z.string().nullable(),
  nextReviewDate: z.string().nullable(),
});

export class CreateCardDto extends createZodDto(createCardSchema) {}
export class UpdateCardDto extends createZodDto(updateCardSchema) {}
export class CardListQueryDto extends createZodDto(cardListQuerySchema) {}
export class CardResponseDto extends createZodDto(cardResponseSchema) {}
export class CardListDto extends createZodDto(listResponseSchema(cardResponseSchema)) {}
export class CardStatsDto extends createZodDto(cardStatsResponseSchema) {}

export type CardResponse = z.infer<typeof cardResponseSchema>;
export type CardStats = z.infer<typeof cardStatsResponseSchema>;
export type CardListQuery = z.infer<typeof cardListQuerySchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
