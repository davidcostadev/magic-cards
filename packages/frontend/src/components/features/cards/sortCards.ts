import type { Card, CardStats } from '@/api/queries/cards';

/** Orderings offered by the card list. `recent` keeps the API order (newest card first). */
export const CARD_SORTS = [
  'recent',
  'hardest',
  'easiest',
  'mostReviewed',
  'lastReviewed',
  'alphabetical',
] as const;

export type CardSort = (typeof CARD_SORTS)[number];

/** How the user is doing on a card, keyed by card id (missing = never studied). */
export type CardStatsMap = ReadonlyMap<string, CardStats>;

export type CardDifficulty = 'hard' | 'medium' | 'easy';

const HARD_ACCURACY = 60;
const EASY_ACCURACY = 85;
const HARD_EASE = 2.0;
const EASY_EASE = 2.5;
/** SM-2 starts every card here, so it's the neutral stand-in when there's no progress row yet. */
const DEFAULT_EASE = 2.5;

/**
 * A card's difficulty *for this user*, from their own performance: accuracy first (did they get
 * it right?), ease factor second (how fast SM-2 is willing to space it out). Null until the card
 * has been reviewed at least once — an unstudied card isn't easy, it's simply unknown.
 */
export function cardDifficulty(stats: CardStats | undefined): CardDifficulty | null {
  if (!stats || stats.totalReviews === 0) return null;
  const ease = stats.easeFactor ?? DEFAULT_EASE;
  if (stats.accuracy < HARD_ACCURACY || ease < HARD_EASE) return 'hard';
  if (stats.accuracy >= EASY_ACCURACY && ease >= EASY_EASE) return 'easy';
  return 'medium';
}

/** Studied cards rank by accuracy, then by ease — lower is harder. */
function difficultyRank(stats: CardStats): number {
  return stats.accuracy * 10 + (stats.easeFactor ?? DEFAULT_EASE);
}

/** The orderings that compare two studied cards by the learner's performance on them. */
const SCORE_COMPARE: Record<
  Exclude<CardSort, 'recent' | 'alphabetical'>,
  (a: CardStats, b: CardStats) => number
> = {
  hardest: (a, b) => difficultyRank(a) - difficultyRank(b),
  easiest: (a, b) => difficultyRank(b) - difficultyRank(a),
  mostReviewed: (a, b) => b.totalReviews - a.totalReviews,
  lastReviewed: (a, b) => (b.lastReviewDate ?? '').localeCompare(a.lastReviewDate ?? ''),
};

/**
 * Sorts a page-worth of cards by one of `CARD_SORTS`, using the user's own per-card stats.
 * Returns a new array (never mutates). Cards the user has never studied always sink to the
 * bottom of a performance-based ordering: they have no score to compare, so ranking them as
 * "perfect" or "terrible" would both be wrong. Ties keep the incoming order (stable sort).
 */
export function sortCards(cards: Card[], stats: CardStatsMap, sort: CardSort): Card[] {
  if (sort === 'recent') return cards;

  const sorted = [...cards];
  if (sort === 'alphabetical') {
    return sorted.sort((a, b) =>
      a.question.localeCompare(b.question, undefined, { numeric: true })
    );
  }

  // Every remaining ordering scores the card, so unstudied cards (no stats) go last.
  const compare = SCORE_COMPARE[sort];
  return sorted.sort((a, b) => {
    const sa = stats.get(a.id);
    const sb = stats.get(b.id);
    if (!sa || !sb) return sa ? -1 : sb ? 1 : 0;
    return compare(sa, sb);
  });
}
