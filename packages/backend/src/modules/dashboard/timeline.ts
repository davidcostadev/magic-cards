import type { Sm2Service } from '../learning/sm2.service';

/**
 * A single logged review, in chronological order — the raw material of the timeline.
 * `quality` is the effective (hint-capped) value that was persisted, so replaying SM-2
 * over it reproduces exactly the scheduling the learner actually got.
 */
export interface TimelineReview {
  cardId: string;
  quality: number;
  reviewedAt: string;
}

/** One study turn: a burst of reviews with no long pause inside it. */
export interface StudySession {
  startedAt: string;
  endedAt: string;
  reviews: number;
  correct: number;
  /** % of the turn's reviews answered with quality ≥ 3, rounded. */
  accuracy: number;
  /** Cards in `mastered` status once the turn ended — the "am I getting there" curve. */
  mastered: number;
}

/** Reviews further apart than this start a new turn (no session id is stored). */
export const SESSION_GAP_MS = 30 * 60 * 1000;

const PASSING_QUALITY = 3;
const INITIAL_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL = 1;

interface ReplayState {
  interval: number;
  easeFactor: number;
  repetitions: number;
  mastered: boolean;
}

/**
 * Turns a review log into a per-turn progress timeline.
 *
 * Sessions are derived, not stored: consecutive reviews closer than `gapMs` belong to the same
 * turn. The mastered count can't come from `card_progress` either — that table only knows *now* —
 * so SM-2 is replayed over the whole log to know how many cards were mastered at each turn's end.
 * The replay is deterministic (same inputs, same math as `submitReview`), and it can go down as
 * well as up: a lapse pulls a card back out of `mastered`.
 *
 * `limit` trims the *result*, never the input — the replay always starts from the first review,
 * otherwise the mastered count would restart from zero mid-history.
 */
export function buildTimeline(
  reviews: TimelineReview[],
  sm2: Sm2Service,
  options: { gapMs?: number; limit?: number } = {}
): StudySession[] {
  const gapMs = options.gapMs ?? SESSION_GAP_MS;
  const states = new Map<string, ReplayState>();
  const sessions: StudySession[] = [];
  let masteredCount = 0;
  let previousAt = Number.NEGATIVE_INFINITY;

  for (const review of reviews) {
    const at = Date.parse(review.reviewedAt);
    const state = states.get(review.cardId) ?? {
      interval: INITIAL_INTERVAL,
      easeFactor: INITIAL_EASE_FACTOR,
      repetitions: 0,
      mastered: false,
    };
    const next = sm2.calculateNextReview(
      review.quality,
      state.interval,
      state.easeFactor,
      state.repetitions
    );
    const mastered =
      sm2.deriveStatus(next.newRepetitions, next.newInterval, next.newEaseFactor) === 'mastered';
    if (mastered !== state.mastered) masteredCount += mastered ? 1 : -1;
    states.set(review.cardId, {
      interval: next.newInterval,
      easeFactor: next.newEaseFactor,
      repetitions: next.newRepetitions,
      mastered,
    });

    const current = sessions[sessions.length - 1];
    if (!current || at - previousAt > gapMs) {
      sessions.push({
        startedAt: review.reviewedAt,
        endedAt: review.reviewedAt,
        reviews: 1,
        correct: review.quality >= PASSING_QUALITY ? 1 : 0,
        accuracy: 0,
        mastered: masteredCount,
      });
    } else {
      current.endedAt = review.reviewedAt;
      current.reviews += 1;
      if (review.quality >= PASSING_QUALITY) current.correct += 1;
      current.mastered = masteredCount;
    }
    previousAt = at;
  }

  for (const session of sessions) {
    session.accuracy = Math.round((session.correct / session.reviews) * 100);
  }
  // Newest turns are the interesting ones; the chart still reads left-to-right in time.
  return options.limit ? sessions.slice(-options.limit) : sessions;
}
