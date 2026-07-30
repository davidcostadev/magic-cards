import { describe, expect, it } from 'vitest';
import { Sm2Service } from '../learning/sm2.service';
import { buildTimeline, SESSION_GAP_MS, type TimelineReview } from './timeline';

const sm2 = new Sm2Service();
const START = Date.parse('2026-07-01T10:00:00.000Z');
const MINUTE_MS = 60 * 1000;

function review(minutesFromStart: number, quality: number, cardId = 'c1'): TimelineReview {
  return {
    cardId,
    quality,
    reviewedAt: new Date(START + minutesFromStart * MINUTE_MS).toISOString(),
  };
}

describe('buildTimeline', () => {
  it('returns nothing when there is no history', () => {
    expect(buildTimeline([], sm2)).toEqual([]);
  });

  it('groups reviews closer than the gap into one turn', () => {
    const sessions = buildTimeline([review(0, 5), review(10, 4), review(25, 3)], sm2);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      reviews: 3,
      startedAt: new Date(START).toISOString(),
      endedAt: new Date(START + 25 * MINUTE_MS).toISOString(),
    });
  });

  it('starts a new turn after a pause longer than the gap', () => {
    const afterGap = SESSION_GAP_MS / MINUTE_MS + 1;
    const sessions = buildTimeline([review(0, 5), review(afterGap, 5)], sm2);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.reviews)).toEqual([1, 1]);
  });

  it('scores accuracy as the share of reviews with quality >= 3', () => {
    const sessions = buildTimeline([review(0, 5), review(1, 2), review(2, 4), review(3, 1)], sm2);

    expect(sessions[0]).toMatchObject({ reviews: 4, correct: 2, accuracy: 50 });
  });

  it('counts the cards mastered by the end of each turn', () => {
    const day = 24 * 60;
    // Four straight perfect answers push a card past the mastered threshold (interval > 21).
    const reviews = [0, 1, 2, 3].map((i) => review(i * day, 5, 'c1'));
    const sessions = buildTimeline(reviews, sm2);

    expect(sessions.map((s) => s.mastered)).toEqual([0, 0, 0, 1]);
  });

  it('drops a card back out of the mastered count when it lapses', () => {
    const day = 24 * 60;
    const reviews = [
      ...[0, 1, 2, 3].map((i) => review(i * day, 5, 'c1')),
      review(4 * day, 0, 'c1'),
    ];
    const sessions = buildTimeline(reviews, sm2);

    expect(sessions.at(-1)?.mastered).toBe(0);
  });

  it('keeps only the last turns but replays the whole history behind them', () => {
    const day = 24 * 60;
    const reviews = [0, 1, 2, 3].map((i) => review(i * day, 5, 'c1'));
    const sessions = buildTimeline(reviews, sm2, { limit: 2 });

    expect(sessions).toHaveLength(2);
    // The mastered count still knows about the three turns that were trimmed away.
    expect(sessions.at(-1)?.mastered).toBe(1);
  });
});
