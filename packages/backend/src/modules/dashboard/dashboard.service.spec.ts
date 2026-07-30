import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type DatabaseHandle, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, userSubjects, users } from '../../db/schema';
import { Sm2Service } from '../learning/sm2.service';
import { DashboardService } from './dashboard.service';

const DAY_MS = 24 * 60 * 60 * 1000;
let handle: DatabaseHandle;
let db: DrizzleDB;

function service() {
  return new DashboardService(db, new Sm2Service());
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function addReview(daysAgo: number, quality: number, cardId = 'c1') {
  return db.insert(reviewHistory).values({
    userId: 'u1',
    cardId,
    subjectId: 's1',
    quality,
    reviewedAt: isoDaysAgo(daysAgo),
    timeSpent: 1000,
    wasHintUsed: false,
  });
}

function addProgress(
  cardId: string,
  values: {
    easeFactor?: number;
    status?: 'new' | 'learning' | 'reviewing' | 'mastered';
    nextInDays?: number;
  }
) {
  return db.insert(cardProgress).values({
    userId: 'u1',
    cardId,
    interval: 5,
    easeFactor: values.easeFactor ?? 2.5,
    repetitions: 2,
    nextReviewDate: new Date(Date.now() + (values.nextInDays ?? 1) * DAY_MS).toISOString(),
    status: values.status ?? 'reviewing',
  });
}

beforeEach(async () => {
  handle = await createTestDatabase();
  db = handle.db;
  await db
    .insert(users)
    .values({ id: 'u1', email: 'u1@t.com', passwordHash: 'x', username: 'u1', dailyGoal: 2 });
  await db.insert(subjects).values({ id: 's1', userId: 'u1', title: 'S' });
  // Creating a subject adds it to the owner's list, which is what the card pool counts.
  await db.insert(userSubjects).values({ userId: 'u1', subjectId: 's1' });
  for (const id of ['c1', 'c2', 'c3', 'c4']) {
    await db.insert(cards).values({ id, subjectId: 's1', question: id, answer: 'a' });
  }
});

afterEach(async () => {
  await handle.close();
});

describe('DashboardService.getStats', () => {
  it('counts only reviews from today in reviewedToday', async () => {
    await addReview(0, 4);
    await addReview(0, 4);
    await addReview(1, 4); // yesterday
    expect((await service().getStats('u1')).reviewedToday).toBe(2);
  });

  it('computes accuracy as the % of reviews with quality >= 3 over the window', async () => {
    await addReview(1, 4); // pass
    await addReview(1, 1); // fail
    await addReview(2, 5); // pass
    await addReview(10, 4); // pass, outside 7d but inside 30d

    const stats = await service().getStats('u1');
    expect(stats.accuracy7d).toBe(67); // 2 of 3
    expect(stats.accuracy30d).toBe(75); // 3 of 4
  });

  it('returns 0 accuracy when there are no reviews in the window', async () => {
    expect((await service().getStats('u1')).accuracy7d).toBe(0);
  });

  it('counts the streak including today when the goal is met', async () => {
    // goal = 2; today: 2, yesterday: 2, two days ago: 1 (miss)
    await addReview(0, 4);
    await addReview(0, 4);
    await addReview(1, 4);
    await addReview(1, 4);
    await addReview(2, 4);
    expect((await service().getStats('u1')).streak).toBe(2);
  });

  it("excludes today from the streak when today's goal is not yet met", async () => {
    // today: 1 (miss), yesterday: 2, two days ago: 2, three days ago: 1 (miss)
    await addReview(0, 4);
    await addReview(1, 4);
    await addReview(1, 4);
    await addReview(2, 4);
    await addReview(2, 4);
    await addReview(3, 4);
    expect((await service().getStats('u1')).streak).toBe(2);
  });

  it('has a zero streak with no reviews', async () => {
    expect((await service().getStats('u1')).streak).toBe(0);
  });

  it('breaks down cards by status, counting never-reviewed cards as new', async () => {
    await addProgress('c1', { status: 'learning' });
    await addProgress('c2', { status: 'mastered' });
    await addProgress('c3', { status: 'reviewing' });
    // c4 has no progress -> new

    expect((await service().getStats('u1')).cardsByStatus).toEqual({
      new: 1,
      learning: 1,
      reviewing: 1,
      mastered: 1,
    });
  });

  it("leaves cards from subjects outside the learner's list out of the breakdown", async () => {
    await db
      .insert(users)
      .values({ id: 'sys', email: 'sys@t.com', passwordHash: 'x', username: 'sys' });
    await db.insert(subjects).values({ id: 's2', userId: 'sys', title: 'Catalog', isPublic: true });
    // Visible in the catalog, never added: neither its untouched cards nor a stale progress row
    // from back when it was on the list should show up.
    await db.insert(cards).values({ id: 'x1', subjectId: 's2', question: 'x1', answer: 'a' });
    await db.insert(cards).values({ id: 'x2', subjectId: 's2', question: 'x2', answer: 'a' });
    await addProgress('x1', { status: 'mastered' });

    expect((await service().getStats('u1')).cardsByStatus).toEqual({
      new: 4,
      learning: 0,
      reviewing: 0,
      mastered: 0,
    });
  });
});

describe('DashboardService.getWeakCards', () => {
  it('returns cards ordered by ascending ease factor, limited', async () => {
    await addProgress('c1', { easeFactor: 1.4 });
    await addProgress('c2', { easeFactor: 2.1 });
    await addProgress('c3', { easeFactor: 1.3 });

    const weak = await service().getWeakCards('u1', 2);
    expect(weak.map((c) => c.id)).toEqual(['c3', 'c1']);
    expect(weak[0]).toMatchObject({ subjectTitle: 'S' });
    expect(weak[0].easeFactor).toBeCloseTo(1.3, 5);
  });
});

describe('DashboardService.getTimeline', () => {
  it('returns one entry per study turn, oldest first', async () => {
    await addReview(3, 5, 'c1');
    await addReview(3, 2, 'c2'); // same instant-ish → same turn
    await addReview(1, 4, 'c3');

    const timeline = await service().getTimeline('u1', { limit: 30 });
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ reviews: 2, correct: 1, accuracy: 50 });
    expect(timeline[1]).toMatchObject({ reviews: 1, accuracy: 100 });
    expect(Date.parse(timeline[0].startedAt)).toBeLessThan(Date.parse(timeline[1].startedAt));
  });

  it('narrows the timeline to a single subject', async () => {
    await db.insert(subjects).values({ id: 's2', userId: 'u1', title: 'Other' });
    await db.insert(cards).values({ id: 'c9', subjectId: 's2', question: 'q', answer: 'a' });
    await addReview(2, 5, 'c1');
    await db.insert(reviewHistory).values({
      userId: 'u1',
      cardId: 'c9',
      subjectId: 's2',
      quality: 1,
      reviewedAt: isoDaysAgo(1),
      timeSpent: 500,
      wasHintUsed: false,
    });

    const timeline = await service().getTimeline('u1', { subject: 's2', limit: 30 });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ reviews: 1, correct: 0 });
  });

  it('is empty for a learner who has never reviewed', async () => {
    expect(await service().getTimeline('u1', { limit: 30 })).toEqual([]);
  });
});

describe('DashboardService.getUpcoming', () => {
  it('counts cards due today, tomorrow, and within the week', async () => {
    await addProgress('c1', { nextInDays: 0 }); // today
    await addProgress('c2', { nextInDays: 1 }); // tomorrow
    await addProgress('c3', { nextInDays: 3 }); // this week
    await addProgress('c4', { nextInDays: 10 }); // beyond

    const upcoming = await service().getUpcoming('u1');
    expect(upcoming.today).toBe(1);
    expect(upcoming.tomorrow).toBe(1);
    expect(upcoming.thisWeek).toBe(3);
  });
});
