import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type DatabaseHandle, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, subjects, users } from '../../db/schema';
import { GradingService } from './grading.service';
import { LearningService } from './learning.service';
import { Sm2Service } from './sm2.service';

const DAY_MS = 24 * 60 * 60 * 1000;
let handle: DatabaseHandle;
let db: DrizzleDB;

function service() {
  return new LearningService(db, new Sm2Service(), new GradingService());
}

function addCard(id: string) {
  return db.insert(cards).values({ id, subjectId: 's1', question: id, answer: 'a' });
}

function addDueProgress(cardId: string, daysOverdue: number) {
  return db.insert(cardProgress).values({
    userId: 'u1',
    cardId,
    interval: 5,
    easeFactor: 2.5,
    repetitions: 2,
    nextReviewDate: new Date(Date.now() - daysOverdue * DAY_MS).toISOString(),
    status: 'reviewing',
  });
}

function addFutureProgress(cardId: string, daysAhead: number) {
  return db.insert(cardProgress).values({
    userId: 'u1',
    cardId,
    interval: 10,
    easeFactor: 2.5,
    repetitions: 3,
    nextReviewDate: new Date(Date.now() + daysAhead * DAY_MS).toISOString(),
    status: 'reviewing',
  });
}

beforeEach(async () => {
  handle = await createTestDatabase();
  db = handle.db;
  await db.insert(users).values({ id: 'u1', email: 'u1@t.com', passwordHash: 'x', username: 'u1' });
  await db.insert(subjects).values({ id: 's1', userId: 'u1', title: 'S' });
});

afterEach(async () => {
  await handle.close();
});

describe('LearningService.getSessionCards', () => {
  it('fills new cards up to the daily goal (default 20) when nothing is due', async () => {
    for (let i = 1; i <= 25; i++) await addCard(`c${i}`);
    const { due, new: newCards } = await service().getSessionCards('u1');
    expect(due).toHaveLength(0);
    expect(newCards).toHaveLength(20);
  });

  it('counts due cards against the daily goal — due first, new fills the rest', async () => {
    for (let i = 1; i <= 25; i++) await addCard(`c${i}`);
    await addDueProgress('c1', 1);
    await addDueProgress('c2', 2);
    await addDueProgress('c3', 3);

    const { due, new: newCards } = await service().getSessionCards('u1');
    expect(due).toHaveLength(3);
    expect(newCards).toHaveLength(17);
    expect(due.length + newCards.length).toBe(20);
  });

  it('orders overdue cards most-overdue first', async () => {
    await addCard('c1');
    await addCard('c2');
    await addCard('c3');
    await addDueProgress('c1', 1);
    await addDueProgress('c2', 3);
    await addDueProgress('c3', 2);

    const { due } = await service().getSessionCards('u1');
    expect(due.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
  });

  it('excludes cards scheduled for the future', async () => {
    await addCard('c1');
    await db.insert(cardProgress).values({
      userId: 'u1',
      cardId: 'c1',
      interval: 10,
      easeFactor: 2.5,
      repetitions: 3,
      nextReviewDate: new Date(Date.now() + 5 * DAY_MS).toISOString(),
      status: 'reviewing',
    });

    const { due, new: newCards } = await service().getSessionCards('u1');
    expect(due).toHaveLength(0);
    expect(newCards).toHaveLength(0);
  });
});

describe('LearningService.getSessionCards — review ahead', () => {
  it('includes not-yet-due (already-seen) cards when ahead=true, soonest-due first', async () => {
    await addCard('c1');
    await addCard('c2');
    await addCard('c3');
    await addFutureProgress('c1', 5);
    await addFutureProgress('c2', 2);
    await addFutureProgress('c3', 8);

    const due = await service().getSessionCards('u1', undefined, undefined, true);
    expect(due.due.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
    expect(due.new).toHaveLength(0);
  });

  it('still serves genuinely overdue cards before upcoming ones in ahead mode', async () => {
    await addCard('over');
    await addCard('soon');
    await addDueProgress('over', 2);
    await addFutureProgress('soon', 3);

    const { due } = await service().getSessionCards('u1', undefined, undefined, true);
    expect(due.map((c) => c.id)).toEqual(['over', 'soon']);
  });

  it('leaves the normal (non-ahead) session unchanged — future cards stay excluded', async () => {
    await addCard('c1');
    await addFutureProgress('c1', 5);

    const { due, new: newCards } = await service().getSessionCards(
      'u1',
      undefined,
      undefined,
      false
    );
    expect(due).toHaveLength(0);
    expect(newCards).toHaveLength(0);
  });
});

describe('LearningService.getTypeCounts — reviewable pool', () => {
  it('reports the full reviewable pool separately from the due-now counts', async () => {
    await addCard('c1');
    await addCard('c2');
    await addDueProgress('c1', 1);
    await addFutureProgress('c2', 5);

    const counts = await service().getTypeCounts('u1');
    expect(counts.byType.open).toBe(1);
    expect(counts.total).toBe(1);
    expect(counts.reviewableByType.open).toBe(2);
    expect(counts.reviewableTotal).toBe(2);
  });
});

describe('LearningService.getNextCard', () => {
  it('serves an overdue card before any new card', async () => {
    await addCard('due');
    await addDueProgress('due', 2);
    await addCard('new1');

    expect((await service().getNextCard('u1'))?.id).toBe('due');
  });

  it('serves a new card when nothing is due', async () => {
    await addCard('new1');
    expect((await service().getNextCard('u1'))?.id).toBe('new1');
  });

  it('returns null when the queue is empty', async () => {
    expect(await service().getNextCard('u1')).toBeNull();
  });
});
