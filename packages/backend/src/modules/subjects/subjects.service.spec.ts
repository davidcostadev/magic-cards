import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type DatabaseHandle, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, users } from '../../db/schema';
import { Sm2Service } from '../learning/sm2.service';
import { SubjectsService } from './subjects.service';

const DAY_MS = 24 * 60 * 60 * 1000;
let handle: DatabaseHandle;
let db: DrizzleDB;

function service() {
  return new SubjectsService(db, new Sm2Service());
}

function addReview(
  cardId: string,
  quality: number,
  opts: { timeSpent?: number; wasHintUsed?: boolean; subjectId?: string } = {}
) {
  return db.insert(reviewHistory).values({
    userId: 'u1',
    cardId,
    subjectId: opts.subjectId ?? 's1',
    quality,
    timeSpent: opts.timeSpent ?? 1000,
    wasHintUsed: opts.wasHintUsed ?? false,
  });
}

function addProgress(
  cardId: string,
  values: {
    easeFactor?: number;
    repetitions?: number;
    interval?: number;
    status?: 'new' | 'learning' | 'reviewing' | 'mastered';
    nextInDays?: number;
    userId?: string;
  } = {}
) {
  return db.insert(cardProgress).values({
    userId: values.userId ?? 'u1',
    cardId,
    interval: values.interval ?? 5,
    easeFactor: values.easeFactor ?? 2.5,
    repetitions: values.repetitions ?? 2,
    status: values.status ?? 'reviewing',
    lastReviewDate: new Date(Date.now() - DAY_MS).toISOString(),
    nextReviewDate: new Date(Date.now() + (values.nextInDays ?? 1) * DAY_MS).toISOString(),
  });
}

beforeEach(async () => {
  handle = await createTestDatabase();
  db = handle.db;
  await db.insert(users).values([
    { id: 'u1', email: 'u1@t.com', passwordHash: 'x', username: 'u1' },
    { id: 'u2', email: 'u2@t.com', passwordHash: 'x', username: 'u2' },
  ]);
  await db.insert(subjects).values({ id: 's1', userId: 'u1', title: 'S' });
  for (const id of ['c1', 'c2', 'c3']) {
    await db.insert(cards).values({ id, subjectId: 's1', question: id, answer: 'a' });
  }
});

afterEach(async () => {
  await handle.close();
});

describe('SubjectsService.cardStats', () => {
  it('returns one row per studied card with review aggregates and SM-2 state', async () => {
    await addReview('c1', 5);
    await addReview('c1', 2, { timeSpent: 3000, wasHintUsed: true });
    await addProgress('c1', { easeFactor: 1.8, repetitions: 3, interval: 4, status: 'learning' });

    const [row] = await service().cardStats('u1', 's1');

    expect(row).toMatchObject({
      cardId: 'c1',
      totalReviews: 2,
      correctCount: 1,
      incorrectCount: 1,
      accuracy: 50,
      avgTimeMs: 2000,
      hintedCount: 1,
      easeFactor: 1.8,
      repetitions: 3,
      interval: 4,
      status: 'learning',
    });
    expect(row.lastReviewDate).toEqual(expect.any(String));
    expect(row.nextReviewDate).toEqual(expect.any(String));
  });

  it('omits never-studied cards and never counts another user reviews', async () => {
    await addReview('c1', 4);
    await addProgress('c1');
    await db.insert(reviewHistory).values({
      userId: 'u2',
      cardId: 'c2',
      subjectId: 's1',
      quality: 5,
      timeSpent: 500,
    });
    await addProgress('c2', { userId: 'u2' });

    const rows = await service().cardStats('u1', 's1');

    expect(rows.map((r) => r.cardId)).toEqual(['c1']);
    expect(rows[0].totalReviews).toBe(1);
  });

  it('includes a card that has SM-2 progress but no review rows yet', async () => {
    await addProgress('c3', { easeFactor: 2.2 });

    const rows = await service().cardStats('u1', 's1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cardId: 'c3',
      totalReviews: 0,
      accuracy: 0,
      avgTimeMs: 0,
      easeFactor: 2.2,
    });
  });
});

describe('SubjectsService.stats', () => {
  it('adds review-based accuracy and the average ease factor', async () => {
    await addReview('c1', 5);
    await addReview('c1', 4);
    await addReview('c2', 1);
    await addProgress('c1', { easeFactor: 2.6 });
    await addProgress('c2', { easeFactor: 2.0 });

    const stats = await service().stats('u1', 's1');

    expect(stats.totalReviews).toBe(3);
    expect(stats.accuracy).toBe(67); // 2 of 3 graded >= 3
    expect(stats.avgEaseFactor).toBeCloseTo(2.3, 5);
  });

  it('reports zero accuracy and a null ease factor before any study', async () => {
    const stats = await service().stats('u1', 's1');

    expect(stats).toMatchObject({ totalReviews: 0, accuracy: 0, avgEaseFactor: null });
  });
});

describe('SubjectsService.progressBySubject', () => {
  it('reports mastered count, accuracy and average ease per subject', async () => {
    await addReview('c1', 5);
    await addReview('c2', 2);
    await addProgress('c1', { status: 'mastered', easeFactor: 2.6 });
    await addProgress('c2', { status: 'learning', easeFactor: 2.0 });

    const [row] = await service().progressBySubject('u1');

    expect(row).toMatchObject({
      subjectId: 's1',
      total: 3,
      reviewed: 2,
      mastered: 1,
      totalReviews: 2,
      accuracy: 50,
    });
    expect(row.avgEaseFactor).toBeCloseTo(2.3, 5);
  });

  it('leaves the average ease null for a subject that was never studied', async () => {
    const [row] = await service().progressBySubject('u1');

    expect(row).toMatchObject({ subjectId: 's1', reviewed: 0, avgEaseFactor: null });
  });
});
