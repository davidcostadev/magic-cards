import { Injectable } from '@nestjs/common';

export type CardStatus = 'new' | 'learning' | 'reviewing' | 'mastered';

export interface Sm2Result {
  newInterval: number;
  newEaseFactor: number;
  newRepetitions: number;
}

const MIN_EASE_FACTOR = 1.3;
const MAX_HINTED_QUALITY = 3;

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
      return { newInterval: 1, newEaseFactor, newRepetitions: 0 };
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
