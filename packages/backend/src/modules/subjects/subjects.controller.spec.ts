import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '../../db/schema';
import { createTestApp, signupAndToken } from '../../test-support/create-test-app';

let app: NestFastifyApplication;
let db: Awaited<ReturnType<typeof createTestApp>>['db'];
let token: string;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await db.delete(users);
  token = await signupAndToken(app, 'owner@test.com', 'owner');
});

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('Subjects CRUD', () => {
  it('creates a subject and returns it with cardCount 0', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/subjects')
        .send({ title: 'TypeScript', color: '#3178c6', icon: 'code' })
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'TypeScript', color: '#3178c6', cardCount: 0 });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('lists the user subjects in the Stripe list envelope', async () => {
    await auth(request(app.getHttpServer()).post('/v1/subjects').send({ title: 'A' }));
    await auth(request(app.getHttpServer()).post('/v1/subjects').send({ title: 'B' }));

    const res = await auth(request(app.getHttpServer()).get('/v1/subjects'));

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.has_more).toBe(false);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe('B'); // newest first
  });

  it('updates a subject', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Old' })
    );
    const res = await auth(
      request(app.getHttpServer())
        .patch(`/v1/subjects/${created.body.id}`)
        .send({ title: 'New', description: 'desc' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'New', description: 'desc' });
  });

  it('deletes a subject', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Temp' })
    );
    const res = await auth(request(app.getHttpServer()).delete(`/v1/subjects/${created.body.id}`));
    expect(res.status).toBe(204);

    const after = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    expect(after.body.data).toHaveLength(0);
  });

  it('returns stats for a subject', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Stats' })
    );
    const res = await auth(
      request(app.getHttpServer()).get(`/v1/subjects/${created.body.id}/stats`)
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalCards: 0,
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
      due: 0,
    });
  });

  it('rejects validation errors (empty title) with 400', async () => {
    const res = await auth(request(app.getHttpServer()).post('/v1/subjects').send({ title: '' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('errors.validation');
  });

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer()).get('/v1/subjects');
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's subject (no existence leak)", async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Mine' })
    );
    const otherToken = await signupAndToken(app, 'other@test.com', 'other');

    const res = await request(app.getHttpServer())
      .get(`/v1/subjects/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('subjects.notFound');
  });
});
