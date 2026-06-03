import type { Card, CardChoice, CardPayload, MatchPair } from '../../db/schema';
import type { CardResponse } from './dto/card.dto';

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

  // Studied / browsed by a non-owner: hide the answer and all grading data.
  if (card.type === 'quiz') {
    const choices = (payload as { choices: CardChoice[] } | null)?.choices ?? [];
    return { ...base, answer: '', choices: choices.map((c) => ({ id: c.id, text: c.text })) };
  }
  if (card.type === 'match') {
    const pairs = (payload as { matchPairs: MatchPair[] } | null)?.matchPairs ?? [];
    // Sent for client-side matching (see the doc comment); the client shuffles and windows them.
    return { ...base, answer: '', matchPairs: pairs };
  }
  // type-answer: nothing extra to expose before grading.
  return { ...base, answer: '' };
}

function revealedPayload(payload: CardPayload): Partial<CardResponse> {
  if (payload && 'choices' in payload) return { choices: payload.choices };
  if (payload && 'shortAnswer' in payload) return { shortAnswer: payload.shortAnswer };
  if (payload && 'matchPairs' in payload) return { matchPairs: payload.matchPairs };
  return {};
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
