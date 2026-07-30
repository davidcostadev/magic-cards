import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type DatabaseHandle, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, userSubjects, users } from '../../db/schema';
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
  // Creating a subject adds it to the owner's list, so every study query sees it.
  await db.insert(userSubjects).values({ userId: 'u1', subjectId: 's1' });
});

afterEach(async () => {
  await handle.close();
});

describe('LearningService.getSessionCards', () => {
  it('fills new cards up to the session size (10) when nothing is due', async () => {
    for (let i = 1; i <= 25; i++) await addCard(`c${i}`);
    const { due, new: newCards } = await service().getSessionCards('u1');
    expect(due).toHaveLength(0);
    expect(newCards).toHaveLength(10);
  });

  it('counts due cards against the session size — due first, new fills the rest', async () => {
    for (let i = 1; i <= 25; i++) await addCard(`c${i}`);
    await addDueProgress('c1', 1);
    await addDueProgress('c2', 2);
    await addDueProgress('c3', 3);

    const { due, new: newCards } = await service().getSessionCards('u1');
    expect(due).toHaveLength(3);
    expect(newCards).toHaveLength(7);
    expect(due.length + newCards.length).toBe(10);
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

describe('LearningService.getSessionCards — recall-probability ordering', () => {
  it('orders the harder (shorter-interval) card first even when it is less overdue in days', async () => {
    await addCard('hard');
    await addCard('easy');
    // hard: short interval, mildly overdue → high overdue-vs-interval ratio (more likely forgotten).
    await db.insert(cardProgress).values({
      userId: 'u1',
      cardId: 'hard',
      interval: 2,
      easeFactor: 1.4,
      repetitions: 1,
      nextReviewDate: new Date(Date.now() - 3 * DAY_MS).toISOString(),
      lastReviewDate: new Date(Date.now() - 5 * DAY_MS).toISOString(),
      status: 'learning',
    });
    // easy: long interval, MORE overdue in absolute days, but a low ratio (still mostly remembered).
    await db.insert(cardProgress).values({
      userId: 'u1',
      cardId: 'easy',
      interval: 20,
      easeFactor: 2.6,
      repetitions: 6,
      nextReviewDate: new Date(Date.now() - 5 * DAY_MS).toISOString(),
      lastReviewDate: new Date(Date.now() - 25 * DAY_MS).toISOString(),
      status: 'reviewing',
    });

    const { due } = await service().getSessionCards('u1');
    // ratio hard = 3/2 = 1.5 > easy = 5/20 = 0.25 → 'hard' first. The old nextReviewDate-asc
    // ordering would have served 'easy' first as the card overdue by more calendar days.
    expect(due.map((c) => c.id)).toEqual(['hard', 'easy']);
  });
});

describe('LearningService.getSessionCards — practice mistakes', () => {
  function addReview(cardId: string, quality: number) {
    return db
      .insert(reviewHistory)
      .values({ userId: 'u1', cardId, subjectId: 's1', quality, timeSpent: 1000 });
  }
  function addProgress(
    cardId: string,
    status: 'learning' | 'reviewing' | 'mastered' = 'reviewing'
  ) {
    return db.insert(cardProgress).values({
      userId: 'u1',
      cardId,
      interval: 5,
      easeFactor: 2.5,
      repetitions: 2,
      nextReviewDate: new Date(Date.now() - DAY_MS).toISOString(),
      lastReviewDate: new Date().toISOString(),
      status,
    });
  }

  it('serves only the cards the learner has gotten wrong, most-errored first', async () => {
    await addCard('worst');
    await addProgress('worst');
    await addCard('bad');
    await addProgress('bad');
    await addCard('clean');
    await addProgress('clean');
    // worst: 3 wrong; bad: 1 wrong; clean: only correct answers. Both pending (last answer wrong).
    await addReview('worst', 1);
    await addReview('worst', 2);
    await addReview('worst', 0);
    await addReview('bad', 4);
    await addReview('bad', 2);
    await addReview('clean', 5);
    await addReview('clean', 4);

    const { due, new: newCards } = await service().getSessionCards(
      'u1',
      undefined,
      undefined,
      false,
      true
    );
    expect(due.map((c) => c.id)).toEqual(['worst', 'bad']);
    expect(newCards).toHaveLength(0);
  });

  it('drops a card once the learner answers it right again, and takes it back on a new slip', async () => {
    await addCard('fixed');
    await addProgress('fixed');
    await addReview('fixed', 1);
    await addReview('fixed', 4); // debt paid — the mistake is no longer pending

    const service_ = service();
    expect(
      (await service_.getSessionCards('u1', undefined, undefined, false, true)).due
    ).toHaveLength(0);

    await addReview('fixed', 2); // slipped again — back in the pool
    const { due } = await service_.getSessionCards('u1', undefined, undefined, false, true);
    expect(due.map((c) => c.id)).toEqual(['fixed']);
  });

  it('excludes mastered cards even if they were once wrong', async () => {
    await addCard('done');
    await addProgress('done', 'mastered');
    await addCard('active');
    await addProgress('active', 'reviewing');
    await addReview('done', 1);
    await addReview('active', 1);

    const { due } = await service().getSessionCards('u1', undefined, undefined, false, true);
    expect(due.map((c) => c.id)).toEqual(['active']);
  });

  it('is empty when the learner has no wrong answers', async () => {
    await addCard('c1');
    await addProgress('c1');
    await addReview('c1', 5);

    const { due, new: newCards } = await service().getSessionCards(
      'u1',
      undefined,
      undefined,
      false,
      true
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

  it('counts distinct non-mastered cards whose last answer was wrong as mistakesTotal', async () => {
    for (const id of ['a', 'b', 'c', 'm', 'fixed']) await addCard(id);
    const prog = (id: string, status: 'reviewing' | 'mastered' = 'reviewing') =>
      db.insert(cardProgress).values({
        userId: 'u1',
        cardId: id,
        interval: 5,
        easeFactor: 2.5,
        repetitions: 2,
        nextReviewDate: new Date(Date.now() - DAY_MS).toISOString(),
        lastReviewDate: new Date().toISOString(),
        status,
      });
    await prog('a');
    await prog('b');
    await prog('c');
    await prog('m', 'mastered');
    await prog('fixed');
    await db.insert(reviewHistory).values([
      { userId: 'u1', cardId: 'a', subjectId: 's1', quality: 1, timeSpent: 1 },
      { userId: 'u1', cardId: 'a', subjectId: 's1', quality: 2, timeSpent: 1 }, // a counts once
      { userId: 'u1', cardId: 'b', subjectId: 's1', quality: 0, timeSpent: 1 },
      { userId: 'u1', cardId: 'c', subjectId: 's1', quality: 5, timeSpent: 1 }, // c: never wrong
      { userId: 'u1', cardId: 'm', subjectId: 's1', quality: 1, timeSpent: 1 }, // m: wrong but mastered
      { userId: 'u1', cardId: 'fixed', subjectId: 's1', quality: 1, timeSpent: 1 },
      { userId: 'u1', cardId: 'fixed', subjectId: 's1', quality: 4, timeSpent: 1 }, // answered right since
    ]);

    const counts = await service().getTypeCounts('u1');
    expect(counts.mistakesTotal).toBe(2); // only a and b
  });
});

describe("LearningService — subject scope (only the learner's own list)", () => {
  /** A public catalog subject the learner can SEE but has not added to their list. */
  async function addUnlistedPublicSubject() {
    await db.insert(subjects).values({ id: 's2', userId: 'sys', title: 'Catalog', isPublic: true });
    await db.insert(cards).values({ id: 'x1', subjectId: 's2', question: 'x1', answer: 'a' });
    await db
      .insert(cards)
      .values({ id: 'x2', subjectId: 's2', type: 'quiz', question: 'x2', answer: 'a' });
  }

  beforeEach(async () => {
    await db
      .insert(users)
      .values({ id: 'sys', email: 'sys@t.com', passwordHash: 'x', username: 'sys' });
  });

  it('leaves cards from a visible-but-not-added subject out of an unscoped session', async () => {
    await addCard('mine');
    await addUnlistedPublicSubject();

    const { due, new: newCards } = await service().getSessionCards('u1');
    expect([...due, ...newCards].map((c) => c.id)).toEqual(['mine']);
  });

  it('leaves them out of an unscoped review-ahead session too', async () => {
    await addCard('mine');
    await addFutureProgress('mine', 3);
    await addUnlistedPublicSubject();
    await db.insert(cardProgress).values({
      userId: 'u1',
      cardId: 'x1',
      interval: 10,
      easeFactor: 2.5,
      repetitions: 3,
      nextReviewDate: new Date(Date.now() + DAY_MS).toISOString(),
      status: 'reviewing',
    });

    const { due, new: newCards } = await service().getSessionCards(
      'u1',
      undefined,
      undefined,
      true
    );
    expect([...due, ...newCards].map((c) => c.id)).toEqual(['mine']);
  });

  it('leaves them out of the type counts (due and reviewable alike)', async () => {
    await addCard('mine');
    await addUnlistedPublicSubject();

    const counts = await service().getTypeCounts('u1');
    expect(counts.total).toBe(1);
    expect(counts.reviewableTotal).toBe(1);
    expect(counts.byType.quiz).toBe(0);
    expect(counts.reviewableByType.quiz).toBe(0);
  });

  it('drops past mistakes made in a subject the learner has since removed from their list', async () => {
    await addUnlistedPublicSubject();
    await db.insert(cardProgress).values({
      userId: 'u1',
      cardId: 'x1',
      interval: 5,
      easeFactor: 2.5,
      repetitions: 2,
      nextReviewDate: new Date(Date.now() - DAY_MS).toISOString(),
      lastReviewDate: new Date().toISOString(),
      status: 'reviewing',
    });
    await db
      .insert(reviewHistory)
      .values({ userId: 'u1', cardId: 'x1', subjectId: 's2', quality: 1, timeSpent: 1 });

    expect((await service().getTypeCounts('u1')).mistakesTotal).toBe(0);
    const { due } = await service().getSessionCards('u1', undefined, undefined, false, true);
    expect(due).toHaveLength(0);
  });

  it('still studies a not-added subject when the learner picks it explicitly', async () => {
    await addUnlistedPublicSubject();

    const { new: newCards } = await service().getSessionCards('u1', 's2');
    expect(newCards.map((c) => c.id)).toEqual(['x1', 'x2']);
    expect((await service().getTypeCounts('u1', 's2')).reviewableTotal).toBe(2);
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

describe('LearningService.checkReview', () => {
  function addQuiz(id: string) {
    return db.insert(cards).values({
      id,
      subjectId: 's1',
      type: 'quiz',
      question: id,
      answer: 'because b',
      payload: {
        choices: [
          { id: 'a', text: 'A', isCorrect: false },
          { id: 'b', text: 'B', isCorrect: true },
        ],
      },
    });
  }

  it('grades a correct answer and reveals the explanation', async () => {
    await addQuiz('q1');
    const grade = await service().checkReview('u1', {
      cardId: 'q1',
      response: { type: 'quiz', choiceId: 'b' },
    });
    expect(grade.correct).toBe(true);
    expect(grade.correctChoiceId).toBe('b');
    expect(grade.explanation).toBe('because b');
  });

  it('grades a wrong answer as incorrect but still reveals the right choice', async () => {
    await addQuiz('q1');
    const grade = await service().checkReview('u1', {
      cardId: 'q1',
      response: { type: 'quiz', choiceId: 'a' },
    });
    expect(grade.correct).toBe(false);
    expect(grade.correctChoiceId).toBe('b');
  });

  it('persists nothing — no progress and no review history (re-practice only)', async () => {
    await addQuiz('q1');
    await service().checkReview('u1', { cardId: 'q1', response: { type: 'quiz', choiceId: 'a' } });
    await service().checkReview('u1', { cardId: 'q1', response: { type: 'quiz', choiceId: 'b' } });
    expect(await db.select().from(cardProgress)).toHaveLength(0);
    expect(await db.select().from(reviewHistory)).toHaveLength(0);
  });

  it("returns 404 for another user's card", async () => {
    await addQuiz('q1');
    await db
      .insert(users)
      .values({ id: 'u2', email: 'u2@t.com', passwordHash: 'x', username: 'u2' });
    await expect(
      service().checkReview('u2', { cardId: 'q1', response: { type: 'quiz', choiceId: 'b' } })
    ).rejects.toThrow();
  });
});
