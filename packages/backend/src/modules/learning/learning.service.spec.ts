import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DrizzleDB, runMigrations } from '../../db/client';
import { cardProgress, cards, subjects, users } from '../../db/schema';
import { LearningService } from './learning.service';
import { Sm2Service } from './sm2.service';

const DAY_MS = 24 * 60 * 60 * 1000;
let db: DrizzleDB;

function service() {
  return new LearningService(db, new Sm2Service());
}

function addCard(id: string) {
  db.insert(cards).values({ id, subjectId: 's1', question: id, answer: 'a' }).run();
}

function addDueProgress(cardId: string, daysOverdue: number) {
  db.insert(cardProgress)
    .values({
      userId: 'u1',
      cardId,
      interval: 5,
      easeFactor: 2.5,
      repetitions: 2,
      nextReviewDate: new Date(Date.now() - daysOverdue * DAY_MS).toISOString(),
      status: 'reviewing',
    })
    .run();
}

beforeEach(() => {
  ({ db } = createDatabase(':memory:'));
  runMigrations(db);
  db.insert(users).values({ id: 'u1', email: 'u1@t.com', passwordHash: 'x', username: 'u1' }).run();
  db.insert(subjects).values({ id: 's1', userId: 'u1', title: 'S' }).run();
});

describe('LearningService.getSessionCards', () => {
  it('caps new cards at 30% of the daily goal (20 → 6)', () => {
    for (let i = 1; i <= 10; i++) addCard(`c${i}`);
    const { due, new: newCards } = service().getSessionCards('u1');
    expect(due).toHaveLength(0);
    expect(newCards).toHaveLength(6);
  });

  it('orders overdue cards most-overdue first', () => {
    addCard('c1');
    addCard('c2');
    addCard('c3');
    addDueProgress('c1', 1);
    addDueProgress('c2', 3);
    addDueProgress('c3', 2);

    const { due } = service().getSessionCards('u1');
    expect(due.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
  });

  it('excludes cards scheduled for the future', () => {
    addCard('c1');
    db.insert(cardProgress)
      .values({
        userId: 'u1',
        cardId: 'c1',
        interval: 10,
        easeFactor: 2.5,
        repetitions: 3,
        nextReviewDate: new Date(Date.now() + 5 * DAY_MS).toISOString(),
        status: 'reviewing',
      })
      .run();

    const { due, new: newCards } = service().getSessionCards('u1');
    expect(due).toHaveLength(0);
    expect(newCards).toHaveLength(0);
  });
});

describe('LearningService.getNextCard', () => {
  it('serves an overdue card before any new card', () => {
    addCard('due');
    addDueProgress('due', 2);
    addCard('new1');

    expect(service().getNextCard('u1')?.id).toBe('due');
  });

  it('serves a new card when nothing is due', () => {
    addCard('new1');
    expect(service().getNextCard('u1')?.id).toBe('new1');
  });

  it('returns null when the queue is empty', () => {
    expect(service().getNextCard('u1')).toBeNull();
  });
});
