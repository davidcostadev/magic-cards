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

async function createSubject(): Promise<string> {
  const res = await auth(request(app.getHttpServer()).post('/v1/subjects').send({ title: 'S' }));
  return res.body.id;
}

beforeEach(async () => {
  await db.delete(users);
  token = await signupAndToken(app, 'owner@test.com', 'owner');
  subjectId = await createSubject();
});

describe('Cards CRUD', () => {
  it('creates a card with hints and tags', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({
          subjectId,
          question: 'Q?',
          answer: 'A',
          hints: ['h1', 'h2'],
          tags: ['t1'],
        })
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      subjectId,
      question: 'Q?',
      answer: 'A',
      hints: ['h1', 'h2'],
      tags: ['t1'],
    });
  });

  it('defaults hints and tags to empty arrays', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/v1/cards').send({ subjectId, question: 'Q', answer: 'A' })
    );
    expect(res.body.hints).toEqual([]);
    expect(res.body.tags).toEqual([]);
  });

  it('lists cards filtered by subject', async () => {
    await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId, question: 'Q1', answer: 'A' })
    );
    await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId, question: 'Q2', answer: 'A' })
    );

    const res = await auth(request(app.getHttpServer()).get(`/v1/cards?subject=${subjectId}`));
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(2);
  });

  it('requires the subject query param when listing', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/cards'));
    expect(res.status).toBe(400);
  });

  it('updates a card', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/cards').send({ subjectId, question: 'Q', answer: 'A' })
    );
    const res = await auth(
      request(app.getHttpServer())
        .patch(`/v1/cards/${created.body.id}`)
        .send({ answer: 'Updated', tags: ['x'] })
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ question: 'Q', answer: 'Updated', tags: ['x'] });
  });

  it('deletes a card', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/cards').send({ subjectId, question: 'Q', answer: 'A' })
    );
    const del = await auth(request(app.getHttpServer()).delete(`/v1/cards/${created.body.id}`));
    expect(del.status).toBe(204);

    const get = await auth(request(app.getHttpServer()).get(`/v1/cards/${created.body.id}`));
    expect(get.status).toBe(404);
  });

  it("returns 404 when creating a card in another user's subject", async () => {
    const otherToken = await signupAndToken(app, 'other@test.com', 'other');
    const res = await request(app.getHttpServer())
      .post('/v1/cards')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ subjectId, question: 'Q', answer: 'A' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('subjects.notFound');
  });

  it("returns 404 reading another user's card", async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/cards').send({ subjectId, question: 'Q', answer: 'A' })
    );
    const otherToken = await signupAndToken(app, 'other@test.com', 'other');

    const res = await request(app.getHttpServer())
      .get(`/v1/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('defaults a card with no explicit type to open', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/v1/cards').send({ subjectId, question: 'Q', answer: 'A' })
    );
    expect(res.body.type).toBe('open');
  });
});

describe('Interactive card types', () => {
  function post(body: Record<string, unknown>) {
    return auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId, ...body })
    );
  }

  it('creates a quiz card and returns choices (with isCorrect) to its owner', async () => {
    const res = await post({
      type: 'quiz',
      question: 'Pick one',
      answer: 'B is right',
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('quiz');
    expect(res.body.choices).toEqual([
      { id: 'a', text: 'A', isCorrect: false },
      { id: 'b', text: 'B', isCorrect: true },
    ]);
  });

  it('rejects a quiz without exactly one correct choice', async () => {
    const res = await post({
      type: 'quiz',
      question: 'Pick one',
      answer: 'x',
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: false },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.param).toBe('choices');
  });

  it('creates a type-answer card and returns its shortAnswer to the owner', async () => {
    const res = await post({
      type: 'type-answer',
      question: 'Utility type?',
      answer: 'Partial<T>',
      shortAnswer: 'Partial',
    });
    expect(res.status).toBe(201);
    expect(res.body.shortAnswer).toBe('Partial');
  });

  it('rejects a type-answer without a shortAnswer', async () => {
    const res = await post({ type: 'type-answer', question: 'Q', answer: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error.param).toBe('shortAnswer');
  });

  it('creates a match card and returns its pairs to the owner', async () => {
    const res = await post({
      type: 'match',
      question: 'Match',
      matchPairs: [
        { left: 'TS', right: 'TypeScript' },
        { left: 'PY', right: 'Python' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('match');
    expect(res.body.matchPairs).toHaveLength(2);
  });

  it('rejects a match with fewer than two pairs', async () => {
    const res = await post({
      type: 'match',
      question: 'Match',
      matchPairs: [{ left: 'TS', right: 'TypeScript' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.param).toBe('matchPairs');
  });

  it('re-validates the merged card on update (cannot drop the correct choice)', async () => {
    const created = await post({
      type: 'quiz',
      question: 'Pick one',
      answer: 'B',
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
      ],
    });
    const res = await auth(
      request(app.getHttpServer())
        .patch(`/v1/cards/${created.body.id}`)
        .send({
          choices: [
            { id: 'a', text: 'A', isCorrect: false },
            { id: 'b', text: 'B', isCorrect: false },
          ],
        })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.param).toBe('choices');
  });

  it('updates a quiz card and persists the edited choices', async () => {
    const created = await post({
      type: 'quiz',
      question: 'Pick one',
      answer: 'B',
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
      ],
    });
    const res = await auth(
      request(app.getHttpServer())
        .patch(`/v1/cards/${created.body.id}`)
        .send({
          choices: [
            { id: 'a', text: 'Alpha', isCorrect: true },
            { id: 'b', text: 'Beta', isCorrect: false },
          ],
        })
    );
    expect(res.status).toBe(200);
    expect(res.body.choices).toEqual([
      { id: 'a', text: 'Alpha', isCorrect: true },
      { id: 'b', text: 'Beta', isCorrect: false },
    ]);
  });
});
