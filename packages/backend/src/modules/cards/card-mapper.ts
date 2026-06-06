import type {
  Card,
  CardChoice,
  CardLanguage,
  CardPayload,
  CardTranslations,
  MatchPair,
} from '../../db/schema';
import type { CardResponse, UpdateCardInput } from './dto/card.dto';

/**
 * Maps a stored card row to its API response, un-nesting the `payload` jsonb into the
 * type-specific fields. `reveal` is true for the browse/authoring view (the cards endpoints
 * serve full content for anything a user may see — their own or shared public cards). It is
 * false only for the study queue (LearningService), where the grading data must be stripped:
 *
 * - quiz        → choices keep `isCorrect` only when revealed
 * - type-answer → `shortAnswer` only when revealed
 * - match       → `matchPairs` is sent for studying too, so the client can validate each
 *                 pairing instantly (the learner opted into client-side matching, and every
 *                 candidate value is already on screen). quiz/type-answer stay hidden.
 *
 * The Markdown `answer`/explanation is the answer for `open` cards (always sent, self-assessed)
 * but a spoiler for the graded types, so it is blanked unless revealed.
 */
export function toCardResponse(card: Card, reveal: boolean): CardResponse {
  const base = {
    id: card.id,
    subjectId: card.subjectId,
    type: card.type,
    language: card.language,
    question: card.question,
    hints: card.hints,
    tags: card.tags,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };

  const translations = card.translations ?? undefined;
  if (card.type === 'open') {
    return { ...base, answer: card.answer, translations };
  }

  const payload = card.payload;
  if (reveal) {
    return { ...base, answer: card.answer, ...revealedPayload(payload), translations };
  }

  // Studied / browsed by a non-owner: hide the answer and all grading data. The QUESTION
  // translation is kept (shown before grading); the translated answer is blanked just like the
  // primary `answer` above, so studying in another language still can't reveal the answer early.
  const studyTr = studyTranslations(card.translations);
  if (card.type === 'quiz') {
    const choices = (payload as { choices: CardChoice[] } | null)?.choices ?? [];
    return {
      ...base,
      answer: '',
      choices: choices.map((c) => ({ id: c.id, text: c.text })),
      translations: studyTr,
    };
  }
  if (card.type === 'match') {
    const pairs = (payload as { matchPairs: MatchPair[] } | null)?.matchPairs ?? [];
    // Sent for client-side matching (see the doc comment); the client shuffles and windows them.
    return { ...base, answer: '', matchPairs: pairs, translations: studyTr };
  }
  // type-answer: nothing extra to expose before grading.
  return { ...base, answer: '', translations: studyTr };
}

/**
 * Translations safe to ship in a study payload: keep each language's question, blank its answer
 * (the answer/explanation is a spoiler for auto-graded cards, like the primary `answer`).
 * Returns undefined when there are no translations, so the field is simply omitted.
 */
function studyTranslations(translations: CardTranslations | null): CardTranslations | undefined {
  if (!translations) return undefined;
  const out: CardTranslations = {};
  for (const lang of Object.keys(translations) as CardLanguage[]) {
    const tr = translations[lang];
    if (tr) out[lang] = { question: tr.question, answer: '' };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function revealedPayload(payload: CardPayload): Partial<CardResponse> {
  if (payload && 'choices' in payload) return { choices: payload.choices };
  if (payload && 'shortAnswer' in payload) return { shortAnswer: payload.shortAnswer };
  if (payload && 'matchPairs' in payload) return { matchPairs: payload.matchPairs };
  return {};
}

/**
 * Reconstructs a full create-shaped card input from a stored card plus a partial edit, so a
 * PATCH can be re-validated against the card's (immutable) type — e.g. a quiz edit can't leave
 * it without a correct choice. Shared by `CardsService.update` (owner edits) and the catalog's
 * `updateCard` (AI/operator edits to public content).
 */
export function mergeCardForValidation(card: Card, dto: UpdateCardInput) {
  const payload = card.payload;
  return {
    subjectId: card.subjectId,
    type: card.type,
    language: dto.language ?? card.language,
    translations: dto.translations ?? card.translations ?? undefined,
    question: dto.question ?? card.question,
    answer: dto.answer ?? card.answer,
    choices: dto.choices ?? (payload && 'choices' in payload ? payload.choices : undefined),
    shortAnswer:
      dto.shortAnswer ?? (payload && 'shortAnswer' in payload ? payload.shortAnswer : undefined),
    matchPairs:
      dto.matchPairs ?? (payload && 'matchPairs' in payload ? payload.matchPairs : undefined),
    hints: dto.hints ?? card.hints,
    tags: dto.tags ?? card.tags,
  };
}

/** Builds the `payload` jsonb to store for a card of the given type from its input fields. */
export function buildPayload(input: {
  type: Card['type'];
  choices?: CardChoice[];
  shortAnswer?: string;
  matchPairs?: MatchPair[];
}): CardPayload {
  switch (input.type) {
    case 'quiz':
      return { choices: input.choices ?? [] };
    case 'type-answer':
      return { shortAnswer: input.shortAnswer ?? '' };
    case 'match':
      return { matchPairs: input.matchPairs ?? [] };
    default:
      return null;
  }
}
