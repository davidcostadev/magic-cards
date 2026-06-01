import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '../../db/schema';
import { createTestApp, signupAndToken } from '../../test-support/create-test-app';

let app: NestFastifyApplication;
let db: Awaited<ReturnType<typeof createTestApp>>['db'];
let token: string;
let subjectId: string;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

async function addCard(question: string): Promise<string> {
  const res = await auth(
    request(app.getHttpServer())
      .post('/v1/cards')
      .send({ subjectId, question, answer: 'a', hints: ['hint'] })
  );
  return res.body.id;
}

async function addTypedCard(body: Record<string, unknown>): Promise<string> {
  const res = await auth(
    request(app.getHttpServer())
      .post('/v1/cards')
      .send({ subjectId, ...body })
  );
  return res.body.id;
}

beforeEach(async () => {
  await db.delete(users);
  token = await signupAndToken(app, 'owner@test.com', 'owner');
  const subject = await auth(
    request(app.getHttpServer()).post('/v1/subjects').send({ title: 'S' })
  );
  subjectId = subject.body.id;
});

describe('GET /v1/review_queue', () => {
  it('returns new cards in the queue with a total', async () => {
    await addCard('Q1');
    await addCard('Q2');

    const res = await auth(request(app.getHttpServer()).get('/v1/review_queue'));
    expect(res.status).toBe(200);
    expect(res.body.new).toHaveLength(2);
    expect(res.body.due).toHaveLength(0);
    expect(res.body.total).toBe(2);
  });
});

describe('GET /v1/review_queue/next', () => {
  it('returns the next card to study', async () => {
    await addCard('Q1');
    const res = await auth(request(app.getHttpServer()).get('/v1/review_queue/next'));
    expect(res.status).toBe(200);
    expect(res.body.question).toBe('Q1');
  });

  it('returns 204 when there is nothing to study', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/review_queue/next'));
    expect(res.status).toBe(204);
  });
});

describe('POST /v1/reviews', () => {
  it('creates progress and reschedules a passed card', async () => {
    const cardId = await addCard('Q1');

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId, quality: 4, timeSpent: 3000, wasHintUsed: false })
    );

    expect(res.status).toBe(201);
    expect(res.body.progress).toMatchObject({
      cardId,
      repetitions: 1,
      interval: 1,
      status: 'learning',
    });
    expect(res.body.progress.nextReviewDate > new Date().toISOString()).toBe(true);
    expect(res.body.grade).toBeUndefined(); // open cards are self-assessed, not graded

    // The card is no longer immediately due.
    const next = await auth(request(app.getHttpServer()).get('/v1/review_queue/next'));
    expect(next.status).toBe(204);
  });

  it('caps quality at 3 when a hint was used (easy → hard scheduling)', async () => {
    const cardId = await addCard('Q1');

    // quality 5 but hint used → effective quality 3 → still passes (reps 1) but lower ease
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId, quality: 5, timeSpent: 1000, wasHintUsed: true })
    );

    expect(res.status).toBe(201);
    // ease for q=3 from 2.5 is 2.36; q=5 would have been 2.6
    expect(res.body.progress.easeFactor).toBeCloseTo(2.36, 5);
  });

  it('resets a failed card to a 1-day interval', async () => {
    const cardId = await addCard('Q1');
    // pass it a few times first
    await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId, quality: 5, timeSpent: 1000, wasHintUsed: false })
    );
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId, quality: 1, timeSpent: 1000, wasHintUsed: false })
    );

    expect(res.body.progress.interval).toBe(1);
    expect(res.body.progress.repetitions).toBe(0);
  });

  it("returns 404 reviewing another user's card", async () => {
    const cardId = await addCard('Q1');
    const otherToken = await signupAndToken(app, 'other@test.com', 'other');

    const res = await request(app.getHttpServer())
      .post('/v1/reviews')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ cardId, quality: 4, timeSpent: 1000, wasHintUsed: false });

    expect(res.status).toBe(404);
  });

  it('grades a quiz answer server-side and passes the card when correct', async () => {
    const cardId = await addTypedCard({
      type: 'quiz',
      question: 'Pick the right one',
      answer: 'Because B is right.',
      choices: [
        { id: 'a', text: 'Nope', isCorrect: false },
        { id: 'b', text: 'Yes', isCorrect: true },
      ],
    });

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({
          cardId,
          response: { type: 'quiz', choiceId: 'b' },
          timeSpent: 1000,
          wasHintUsed: false,
        })
    );

    expect(res.status).toBe(201);
    expect(res.body.grade).toMatchObject({
      correct: true,
      correctChoiceId: 'b',
      explanation: 'Because B is right.',
    });
    expect(res.body.progress.repetitions).toBe(1); // quality 4 → passed
  });

  it('grades a wrong quiz answer as a lapse (resets interval)', async () => {
    const cardId = await addTypedCard({
      type: 'quiz',
      question: 'Pick the right one',
      answer: 'B is right.',
      choices: [
        { id: 'a', text: 'Nope', isCorrect: false },
        { id: 'b', text: 'Yes', isCorrect: true },
      ],
    });

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({
          cardId,
          response: { type: 'quiz', choiceId: 'a' },
          timeSpent: 1000,
          wasHintUsed: false,
        })
    );

    expect(res.body.grade).toMatchObject({ correct: false, correctChoiceId: 'b' });
    expect(res.body.progress.interval).toBe(1);
    expect(res.body.progress.repetitions).toBe(0);
  });

  it('grades a type-answer leniently (case/whitespace insensitive)', async () => {
    const cardId = await addTypedCard({
      type: 'type-answer',
      question: 'Utility type that makes all props optional?',
      answer: 'Partial<T>',
      shortAnswer: 'Partial',
    });

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({
          cardId,
          response: { type: 'type-answer', text: '  partial ' },
          timeSpent: 1000,
          wasHintUsed: false,
        })
    );

    expect(res.body.grade).toMatchObject({ correct: true, correctText: 'Partial' });
  });

  it('grades a match all-or-nothing', async () => {
    const cardId = await addTypedCard({
      type: 'match',
      question: 'Match the languages',
      matchPairs: [
        { left: 'TS', right: 'TypeScript' },
        { left: 'PY', right: 'Python' },
      ],
    });

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({
          cardId,
          response: {
            type: 'match',
            pairs: [
              { left: 'PY', right: 'Python' },
              { left: 'TS', right: 'TypeScript' },
            ],
          },
          timeSpent: 1000,
          wasHintUsed: false,
        })
    );

    expect(res.body.grade.correct).toBe(true);
    expect(res.body.progress.repetitions).toBe(1);
  });

  it('rejects a review that sends neither quality nor response', async () => {
    const cardId = await addCard('Q1');
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId, timeSpent: 1000, wasHintUsed: false })
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/review_queue — sanitization', () => {
  it('never leaks quiz grading data to the study payload', async () => {
    await addTypedCard({
      type: 'quiz',
      question: 'Q',
      answer: 'explanation',
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
      ],
    });

    const res = await auth(request(app.getHttpServer()).get('/v1/review_queue/next'));
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('quiz');
    expect(res.body.answer).toBe(''); // explanation withheld until graded
    expect(res.body.choices).toHaveLength(2);
    for (const choice of res.body.choices) {
      expect(choice).not.toHaveProperty('isCorrect');
    }
  });

  it('exposes match items without revealing the pairing', async () => {
    await addTypedCard({
      type: 'match',
      question: 'Match',
      matchPairs: [
        { left: 'TS', right: 'TypeScript' },
        { left: 'PY', right: 'Python' },
      ],
    });

    const res = await auth(request(app.getHttpServer()).get('/v1/review_queue/next'));
    expect(res.body.matchItems.lefts).toEqual(['TS', 'PY']);
    expect([...res.body.matchItems.rights].sort()).toEqual(['Python', 'TypeScript']);
    expect(res.body).not.toHaveProperty('matchPairs');
  });
});
