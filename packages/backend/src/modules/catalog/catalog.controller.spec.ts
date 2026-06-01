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
