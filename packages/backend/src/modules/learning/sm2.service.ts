import { Injectable } from '@nestjs/common';

export type CardStatus = 'new' | 'learning' | 'reviewing' | 'mastered';

export interface Sm2Result {
  newInterval: number;
  newEaseFactor: number;
  newRepetitions: number;
}

const MIN_EASE_FACTOR = 1.3;
const MAX_HINTED_QUALITY = 3;
/** A card with at least a week's interval is "mature": a slip shouldn't collapse it to zero. */
const MATURE_INTERVAL_DAYS = 7;
/** On a mature lapse, keep this fraction of the interval (Anki-style) instead of resetting to 1. */
const LAPSE_INTERVAL_FACTOR = 0.5;
/** A mature lapse never drops below this many repetitions, so recovery uses the ×ease branch. */
const MIN_LAPSE_REPETITIONS = 2;

/**
 * SM-2 spaced repetition scheduling (architecture §7). Pure, framework-agnostic logic —
 * the most critical module in the app, developed strictly test-first (FRD-003).
 */
@Injectable()
export class Sm2Service {
  /** Quality is capped at 3 when any hint was used, so hinted cards return sooner. */
  applyHintCap(quality: number, wasHintUsed: boolean): number {
    return wasHintUsed ? Math.min(quality, MAX_HINTED_QUALITY) : quality;
  }

  calculateNextReview(
    quality: number,
    lastInterval: number,
    lastEaseFactor: number,
    repetitions: number
  ): Sm2Result {
    const newEaseFactor = Math.max(
      MIN_EASE_FACTOR,
      lastEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    if (quality < 3) {
      // Lapse. Immature cards fully reset — they have little maturity to keep, and the in-session
      // short loop re-drills them now. Mature cards instead step back to a reduced interval and
      // keep most of their repetitions, so one good review recovers them via the ×ease branch
      // rather than climbing 1→3→… from scratch (a slip costs days, not weeks).
      if (lastInterval < MATURE_INTERVAL_DAYS) {
        return { newInterval: 1, newEaseFactor, newRepetitions: 0 };
      }
      return {
        newInterval: Math.max(1, Math.round(lastInterval * LAPSE_INTERVAL_FACTOR)),
        newEaseFactor,
        newRepetitions: Math.max(MIN_LAPSE_REPETITIONS, repetitions - 2),
      };
    }

    let newInterval: number;
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 3;
    } else {
      newInterval = Math.round(lastInterval * newEaseFactor);
    }

    return { newInterval, newEaseFactor, newRepetitions: repetitions + 1 };
  }

  /** Derives the display status from progress state (architecture §7, CONTEXT.md). */
  deriveStatus(repetitions: number, interval: number, easeFactor: number): CardStatus {
    if (repetitions === 0) return 'new';
    if (interval > 21 && easeFactor > 2.0) return 'mastered';
    if (repetitions <= 3 && interval < 7) return 'learning';
    return 'reviewing';
  }
}
