import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cardProgress, reviewHistory, users } from '../../db/schema';
import { createTestApp, signupAndToken } from '../../test-support/create-test-app';

let app: NestFastifyApplication;
let db: Awaited<ReturnType<typeof createTestApp>>['db'];
let token: string;
let subjectId: string;
let otherSubjectId: string;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

function auth(req: request.Test, t = token) {
  return req.set('Authorization', `Bearer ${t}`);
}

async function addSubject(title: string, t = token): Promise<string> {
  const res = await auth(request(app.getHttpServer()).post('/v1/subjects').send({ title }), t);
  return res.body.id;
}

/** A match card needs pairs; every other type is fine with question + answer. */
async function addCard(
  question: string,
  type: 'open' | 'quiz' | 'match',
  subject = subjectId,
  t = token
): Promise<string> {
  const body: Record<string, unknown> = { subjectId: subject, question, answer: 'a', type };
  if (type === 'match') {
    body.matchPairs = [
      { left: 'L1', right: 'R1' },
      { left: 'L2', right: 'R2' },
    ];
  }
  if (type === 'quiz') {
    body.choices = [
      { id: 'c1', text: 'a', isCorrect: true },
      { id: 'c2', text: 'b', isCorrect: false },
    ];
  }
  const res = await auth(request(app.getHttpServer()).post('/v1/cards').send(body), t);
  if (res.status !== 201) throw new Error(`card failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

/**
 * Studies a card so it has both a card_progress row and a review_history row. `open` is
 * self-assessed (`quality`); match/quiz are graded server-side and must send a `response`.
 */
async function review(cardId: string, type: 'open' | 'quiz' | 'match', t = token): Promise<void> {
  const graded: Record<string, unknown> = {
    open: { quality: 4 },
    quiz: { response: { type: 'quiz', choiceId: 'c1' } },
    match: {
      response: {
        type: 'match',
        pairs: [
          { left: 'L1', right: 'R1' },
          { left: 'L2', right: 'R2' },
        ],
      },
    },
  };
  const res = await auth(
    request(app.getHttpServer())
      .post('/v1/reviews')
      .send({ cardId, ...(graded[type] as object), timeSpent: 1000, wasHintUsed: false }),
    t
  );
  // A silently rejected review would make every assertion below vacuously pass.
  if (res.status !== 201)
    throw new Error(`review failed: ${res.status} ${JSON.stringify(res.body)}`);
}

async function progressCount(userToken: string, cardId: string): Promise<number> {
  const userId = await userIdFor(userToken);
  const rows = await db
    .select()
    .from(cardProgress)
    .where(and(eq(cardProgress.userId, userId), eq(cardProgress.cardId, cardId)));
  return rows.length;
}

async function historyCount(userToken: string, cardId: string): Promise<number> {
  const userId = await userIdFor(userToken);
  const rows = await db
    .select()
    .from(reviewHistory)
    .where(and(eq(reviewHistory.userId, userId), eq(reviewHistory.cardId, cardId)));
  return rows.length;
}

async function userIdFor(userToken: string): Promise<string> {
  const res = await auth(request(app.getHttpServer()).get('/v1/me'), userToken);
  return res.body.id;
}

beforeEach(async () => {
  await db.delete(users);
  token = await signupAndToken(app, 'owner@test.com', 'owner');
  subjectId = await addSubject('S');
  otherSubjectId = await addSubject('Other');
});

describe('POST /v1/card_progress/reset', () => {
  it('clears progress and history for the matching cards, leaving the rest alone', async () => {
    const matchCard = await addCard('M1', 'match');
    const openCard = await addCard('O1', 'open');
    await review(matchCard, 'match');
    await review(openCard, 'open');

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_progress/reset')
        .send({ subject: subjectId, type: 'match' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cardsReset: 1, reviewsDeleted: 1 });
    // the match card is back to never-studied
    expect(await progressCount(token, matchCard)).toBe(0);
    expect(await historyCount(token, matchCard)).toBe(0);
    // the open card in the same subject is untouched
    expect(await progressCount(token, openCard)).toBe(1);
    expect(await historyCount(token, openCard)).toBe(1);
  });

  it('scopes the type filter to the requested subject', async () => {
    const here = await addCard('M1', 'match');
    const elsewhere = await addCard('M2', 'match', otherSubjectId);
    await review(here, 'match');
    await review(elsewhere, 'match');

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_progress/reset')
        .send({ subject: subjectId, type: 'match' })
    );

    expect(res.status).toBe(200);
    expect(res.body.cardsReset).toBe(1);
    expect(await progressCount(token, elsewhere)).toBe(1);
  });

  it('resets an explicit list of card ids', async () => {
    const a = await addCard('A', 'open');
    const b = await addCard('B', 'open');
    await review(a, 'open');
    await review(b, 'open');

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_progress/reset')
        .send({ cards: [a] })
    );

    expect(res.status).toBe(200);
    expect(res.body.cardsReset).toBe(1);
    expect(await progressCount(token, a)).toBe(0);
    expect(await progressCount(token, b)).toBe(1);
  });

  it("never touches another learner's progress on the same card", async () => {
    const shared = await addCard('M1', 'match');
    await review(shared, 'match');

    const otherToken = await signupAndToken(app, 'other@test.com', 'other');
    const otherSubject = await addSubject('Theirs', otherToken);
    const theirCard = await addCard('M2', 'match', otherSubject, otherToken);
    await review(theirCard, 'match', otherToken);

    await auth(
      request(app.getHttpServer()).post('/v1/card_progress/reset').send({ type: 'match' })
    );

    expect(await progressCount(token, shared)).toBe(0);
    expect(await progressCount(otherToken, theirCard)).toBe(1);
    expect(await historyCount(otherToken, theirCard)).toBe(1);
  });

  it('rejects an unfiltered reset — wiping everything must be explicit', async () => {
    const res = await auth(request(app.getHttpServer()).post('/v1/card_progress/reset').send({}));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('progress.resetFilterRequired');
  });

  it('wipes everything when `all` is set', async () => {
    const a = await addCard('A', 'open');
    const b = await addCard('B', 'match', otherSubjectId);
    await review(a, 'open');
    await review(b, 'match');

    const res = await auth(
      request(app.getHttpServer()).post('/v1/card_progress/reset').send({ all: true })
    );

    expect(res.status).toBe(200);
    expect(res.body.cardsReset).toBe(2);
    expect(await progressCount(token, a)).toBe(0);
    expect(await progressCount(token, b)).toBe(0);
  });

  it('reports zero when nothing matches, without failing', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_progress/reset')
        .send({ subject: subjectId, type: 'match' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cardsReset: 0, reviewsDeleted: 0 });
  });

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/card_progress/reset')
      .send({ type: 'match' });

    expect(res.status).toBe(401);
  });
});
