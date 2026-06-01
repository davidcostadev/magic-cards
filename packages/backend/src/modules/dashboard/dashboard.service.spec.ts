import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DrizzleDB, runMigrations } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, users } from '../../db/schema';
import { DashboardService } from './dashboard.service';

const DAY_MS = 24 * 60 * 60 * 1000;
let db: DrizzleDB;

function service() {
  return new DashboardService(db);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function addReview(daysAgo: number, quality: number, cardId = 'c1') {
  db.insert(reviewHistory)
    .values({
      userId: 'u1',
      cardId,
      subjectId: 's1',
      quality,
      reviewedAt: isoDaysAgo(daysAgo),
      timeSpent: 1000,
      wasHintUsed: false,
    })
    .run();
}

function addProgress(
  cardId: string,
  values: {
    easeFactor?: number;
    status?: 'new' | 'learning' | 'reviewing' | 'mastered';
    nextInDays?: number;
  }
) {
  db.insert(cardProgress)
    .values({
      userId: 'u1',
      cardId,
      interval: 5,
      easeFactor: values.easeFactor ?? 2.5,
      repetitions: 2,
      nextReviewDate: new Date(Date.now() + (values.nextInDays ?? 1) * DAY_MS).toISOString(),
      status: values.status ?? 'reviewing',
    })
    .run();
}

beforeEach(() => {
  ({ db } = createDatabase(':memory:'));
  runMigrations(db);
  db.insert(users)
    .values({ id: 'u1', email: 'u1@t.com', passwordHash: 'x', username: 'u1', dailyGoal: 2 })
    .run();
  db.insert(subjects).values({ id: 's1', userId: 'u1', title: 'S' }).run();
  for (const id of ['c1', 'c2', 'c3', 'c4']) {
    db.insert(cards).values({ id, subjectId: 's1', question: id, answer: 'a' }).run();
  }
});

describe('DashboardService.getStats', () => {
  it('counts only reviews from today in reviewedToday', () => {
    addReview(0, 4);
    addReview(0, 4);
    addReview(1, 4); // yesterday
    expect(service().getStats('u1').reviewedToday).toBe(2);
  });

  it('computes accuracy as the % of reviews with quality >= 3 over the window', () => {
    addReview(1, 4); // pass
    addReview(1, 1); // fail
    addReview(2, 5); // pass
    addReview(10, 4); // pass, outside 7d but inside 30d

    const stats = service().getStats('u1');
    expect(stats.accuracy7d).toBe(67); // 2 of 3
    expect(stats.accuracy30d).toBe(75); // 3 of 4
  });

  it('returns 0 accuracy when there are no reviews in the window', () => {
    expect(service().getStats('u1').accuracy7d).toBe(0);
  });

  it('counts the streak including today when the goal is met', () => {
    // goal = 2; today: 2, yesterday: 2, two days ago: 1 (miss)
    addReview(0, 4);
    addReview(0, 4);
    addReview(1, 4);
    addReview(1, 4);
    addReview(2, 4);
    expect(service().getStats('u1').streak).toBe(2);
  });

  it("excludes today from the streak when today's goal is not yet met", () => {
    // today: 1 (miss), yesterday: 2, two days ago: 2, three days ago: 1 (miss)
    addReview(0, 4);
    addReview(1, 4);
    addReview(1, 4);
    addReview(2, 4);
    addReview(2, 4);
    addReview(3, 4);
    expect(service().getStats('u1').streak).toBe(2);
  });

  it('has a zero streak with no reviews', () => {
    expect(service().getStats('u1').streak).toBe(0);
  });

  it('breaks down cards by status, counting never-reviewed cards as new', () => {
    addProgress('c1', { status: 'learning' });
    addProgress('c2', { status: 'mastered' });
    addProgress('c3', { status: 'reviewing' });
    // c4 has no progress -> new

    expect(service().getStats('u1').cardsByStatus).toEqual({
      new: 1,
      learning: 1,
      reviewing: 1,
      mastered: 1,
    });
  });
});

describe('DashboardService.getWeakCards', () => {
  it('returns cards ordered by ascending ease factor, limited', () => {
    addProgress('c1', { easeFactor: 1.4 });
    addProgress('c2', { easeFactor: 2.1 });
    addProgress('c3', { easeFactor: 1.3 });

    const weak = service().getWeakCards('u1', 2);
    expect(weak.map((c) => c.id)).toEqual(['c3', 'c1']);
    expect(weak[0]).toMatchObject({ easeFactor: 1.3, subjectTitle: 'S' });
  });
});

describe('DashboardService.getUpcoming', () => {
  it('counts cards due today, tomorrow, and within the week', () => {
    addProgress('c1', { nextInDays: 0 }); // today
    addProgress('c2', { nextInDays: 1 }); // tomorrow
    addProgress('c3', { nextInDays: 3 }); // this week
    addProgress('c4', { nextInDays: 10 }); // beyond

    const upcoming = service().getUpcoming('u1');
    expect(upcoming.today).toBe(1);
    expect(upcoming.tomorrow).toBe(1);
    expect(upcoming.thisWeek).toBe(3);
  });
});
