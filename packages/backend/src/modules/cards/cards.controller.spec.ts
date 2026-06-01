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
});
