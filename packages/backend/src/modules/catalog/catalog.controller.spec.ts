import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '../../db/schema';
import { createTestApp, signupAndToken } from '../../test-support/create-test-app';

const API_KEY = 'test-content-api-key-1234567890';

let app: NestFastifyApplication;
let db: Awaited<ReturnType<typeof createTestApp>>['db'];

beforeAll(async () => {
  process.env.CONTENT_API_KEY = API_KEY;
  ({ app, db } = await createTestApp());
});

afterAll(async () => {
  delete process.env.CONTENT_API_KEY;
  await app.close();
});

beforeEach(async () => {
  await db.delete(users);
});

function withKey(req: request.Test) {
  return req.set('x-api-key', API_KEY);
}

async function publishSubject(title = 'Public TS') {
  const res = await withKey(
    request(app.getHttpServer()).post('/v1/catalog/subjects').send({ title })
  );
  return res.body;
}

describe('POST /v1/catalog/* (API key)', () => {
  it('rejects publishing without an API key (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/catalog/subjects')
      .send({ title: 'X' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('catalog.invalidApiKey');
  });

  it('rejects a wrong API key (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/catalog/subjects')
      .set('x-api-key', 'nope')
      .send({ title: 'X' });
    expect(res.status).toBe(401);
  });

  it('publishes a public subject + card with the API key', async () => {
    const subject = await publishSubject();
    expect(subject.isPublic).toBe(true);

    const card = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({ subjectId: subject.id, question: 'Q', answer: 'A' })
    );
    expect(card.status).toBe(201);
    expect(card.body.subjectId).toBe(subject.id);
  });

  it('refuses to add a catalog card to a non-public subject', async () => {
    // A regular user's private subject id should not be publishable into.
    const token = await signupAndToken(app, 'owner@test.com', 'owner');
    const priv = await request(app.getHttpServer())
      .post('/v1/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Private' });

    const res = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({ subjectId: priv.body.id, question: 'Q', answer: 'A' })
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/catalog/subjects/:id (API key)', () => {
  it('deletes a public catalog subject (204) and removes it for users', async () => {
    const subject = await publishSubject('Deletable');
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({ subjectId: subject.id, question: 'Q', answer: 'A' })
    );
    const token = await signupAndToken(app, 'reader@test.com', 'reader');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    // Visible before the delete.
    const before = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    expect(before.body.data.some((s: { id: string }) => s.id === subject.id)).toBe(true);

    const del = await withKey(
      request(app.getHttpServer()).delete(`/v1/catalog/subjects/${subject.id}`)
    );
    expect(del.status).toBe(204);

    // Gone from the list and the study queue (cards cascade-deleted).
    const after = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    expect(after.body.data.some((s: { id: string }) => s.id === subject.id)).toBe(false);
    const queue = await auth(request(app.getHttpServer()).get('/v1/review_queue'));
    expect(queue.body.new.some((c: { question: string }) => c.question === 'Q')).toBe(false);
  });

  it("refuses to delete a regular user's private subject (404)", async () => {
    const token = await signupAndToken(app, 'owner@test.com', 'owner');
    const priv = await request(app.getHttpServer())
      .post('/v1/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Private' });

    const del = await withKey(
      request(app.getHttpServer()).delete(`/v1/catalog/subjects/${priv.body.id}`)
    );
    expect(del.status).toBe(404);

    // The user's subject is untouched.
    const still = await request(app.getHttpServer())
      .get(`/v1/subjects/${priv.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(still.status).toBe(200);
  });

  it('returns 404 deleting a missing subject', async () => {
    const del = await withKey(
      request(app.getHttpServer()).delete(
        '/v1/catalog/subjects/01900000-0000-7000-8000-000000000000'
      )
    );
    expect(del.status).toBe(404);
  });

  it('requires the API key to delete (401)', async () => {
    const subject = await publishSubject('Guarded');
    const del = await request(app.getHttpServer()).delete(`/v1/catalog/subjects/${subject.id}`);
    expect(del.status).toBe(401);
  });
});

describe('POST /v1/catalog/import + GET /v1/catalog/export (API key)', () => {
  const sample = () => ({
    subjects: [{ id: 'io-ts', title: 'TS', description: 'TypeScript', color: '#3178c6' }],
    cards: [
      {
        id: 'io-c1',
        subjectId: 'io-ts',
        type: 'open',
        question: 'What is `unknown`?',
        answer: 'Top type',
      },
      {
        id: 'io-c2',
        subjectId: 'io-ts',
        type: 'quiz',
        question: 'readonly does what?',
        answer: 'Prevents reassignment',
        choices: [
          { id: 'a', text: 'Optional', isCorrect: false },
          { id: 'b', text: 'No reassignment', isCorrect: true },
        ],
      },
      {
        id: 'io-c3',
        subjectId: 'io-ts',
        type: 'type-answer',
        question: 'Utility making all props optional?',
        answer: 'Partial<T>',
        shortAnswer: 'Partial',
      },
      {
        id: 'io-c4',
        subjectId: 'io-ts',
        type: 'match',
        question: 'Match',
        matchPairs: [
          { left: 'Partial', right: 'optional' },
          { left: 'Required', right: 'required' },
        ],
      },
    ],
  });

  it('imports subjects + cards of every type and exports them back (round-trip)', async () => {
    const res = await withKey(
      request(app.getHttpServer()).post('/v1/catalog/import').send(sample())
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      subjects: { created: 1, updated: 0 },
      cards: { created: 4, updated: 0 },
      errors: [],
    });

    const exp = await withKey(request(app.getHttpServer()).get('/v1/catalog/export'));
    expect(exp.status).toBe(200);
    expect(exp.body.subjects.some((s: { id: string }) => s.id === 'io-ts')).toBe(true);
    expect(exp.body.cards).toHaveLength(4);
    const quiz = exp.body.cards.find((c: { id: string }) => c.id === 'io-c2');
    expect(quiz.type).toBe('quiz');
    expect(quiz.choices.find((ch: { id: string }) => ch.id === 'b').isCorrect).toBe(true);

    // The exported document re-imports cleanly (idempotent: everything is now updated).
    const round = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/import')
        .send({ subjects: exp.body.subjects, cards: exp.body.cards })
    );
    expect(round.body.cards.updated).toBe(4);
    expect(round.body.cards.created).toBe(0);
  });

  it('re-importing the same payload updates rather than duplicates', async () => {
    await withKey(request(app.getHttpServer()).post('/v1/catalog/import').send(sample()));
    const again = await withKey(
      request(app.getHttpServer()).post('/v1/catalog/import').send(sample())
    );
    expect(again.body).toMatchObject({
      subjects: { created: 0, updated: 1 },
      cards: { created: 0, updated: 4 },
    });
    const exp = await withKey(request(app.getHttpServer()).get('/v1/catalog/export'));
    expect(exp.body.cards).toHaveLength(4); // not 8
  });

  it('skips invalid cards (per-item errors) but imports the valid ones', async () => {
    const res = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/import')
        .send({
          subjects: [{ id: 'io-x', title: 'X' }],
          cards: [
            { subjectId: 'io-x', type: 'open', question: 'Good', answer: 'A' },
            {
              subjectId: 'io-x',
              type: 'quiz',
              question: 'No correct choice',
              answer: 'expl',
              choices: [
                { id: 'a', text: 'A', isCorrect: false },
                { id: 'b', text: 'B', isCorrect: false },
              ],
            },
            { subjectId: 'does-not-exist', question: 'Orphan', answer: 'A' },
          ],
        })
    );
    expect(res.status).toBe(200);
    expect(res.body.cards.created).toBe(1); // only the valid open card
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors[0].error).toContain('choices');
    expect(res.body.errors[1].error).toBe('subjects.notFound');
  });

  it('requires the API key for import and export (401)', async () => {
    const imp = await request(app.getHttpServer()).post('/v1/catalog/import').send(sample());
    expect(imp.status).toBe(401);
    const exp = await request(app.getHttpServer()).get('/v1/catalog/export');
    expect(exp.status).toBe(401);
  });
});

describe('public content is visible + studyable by any user', () => {
  it('appears in a fresh user’s subject list and study queue, but is read-only', async () => {
    const subject = await publishSubject('Public Algorithms');
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({ subjectId: subject.id, question: 'Big-O?', answer: 'O(log n)' })
    );

    const token = await signupAndToken(app, 'learner@test.com', 'learner');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    // Visible in the list...
    const list = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    expect(list.body.data.some((s: { id: string }) => s.id === subject.id)).toBe(true);

    // ...studyable (the public card is in the queue)...
    const queue = await auth(request(app.getHttpServer()).get('/v1/review_queue'));
    expect(queue.body.new.some((c: { question: string }) => c.question === 'Big-O?')).toBe(true);

    // ...but read-only: a user can't edit public content.
    const edit = await auth(
      request(app.getHttpServer()).patch(`/v1/subjects/${subject.id}`).send({ title: 'Hacked' })
    );
    expect(edit.status).toBe(404);
  });
});
