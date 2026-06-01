import type { Card, CardChoice, CardPayload, MatchPair } from '../../db/schema';
import type { CardResponse } from './dto/card.dto';

/**
 * Maps a stored card row to its API response, un-nesting the `payload` jsonb into the
 * type-specific fields. `reveal` is true only for the owner (authoring); for everyone
 * else — including the owner while studying via the review queue — the grading data is
 * stripped so the answer can't be read off the payload:
 *
 * - quiz        → choices keep `isCorrect` only when revealed
 * - type-answer → `shortAnswer` only when revealed
 * - match       → full `matchPairs` when revealed, else shuffled `matchItems` (no pairing)
 *
 * The Markdown `answer`/explanation is the answer for `open` cards (always sent, self-assessed)
 * but a spoiler for the graded types, so it is blanked unless revealed.
 */
export function toCardResponse(card: Card, reveal: boolean): CardResponse {
  const base = {
    id: card.id,
    subjectId: card.subjectId,
    type: card.type,
    question: card.question,
    hints: card.hints,
    tags: card.tags,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };

  if (card.type === 'open') {
    return { ...base, answer: card.answer };
  }

  const payload = card.payload;
  if (reveal) {
    return { ...base, answer: card.answer, ...revealedPayload(payload) };
  }

  // Studied / browsed by a non-owner: hide the answer and all grading data.
  if (card.type === 'quiz') {
    const choices = (payload as { choices: CardChoice[] } | null)?.choices ?? [];
    return { ...base, answer: '', choices: choices.map((c) => ({ id: c.id, text: c.text })) };
  }
  if (card.type === 'match') {
    const pairs = (payload as { matchPairs: MatchPair[] } | null)?.matchPairs ?? [];
    return {
      ...base,
      answer: '',
      matchItems: {
        lefts: pairs.map((p) => p.left),
        rights: seededShuffle(
          pairs.map((p) => p.right),
          card.id
        ),
      },
    };
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

/**
 * Deterministic Fisher–Yates shuffle seeded by the card id, so a match card's right-column
 * order is stable across requests (no layout jump) yet decoupled from the left column —
 * the pairing can't be inferred from positions. Deterministic also keeps tests stable.
 */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
