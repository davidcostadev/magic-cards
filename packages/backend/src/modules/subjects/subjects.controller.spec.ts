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

  it('reports cardCount once cards exist (single + list)', async () => {
    const subject = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Counted' })
    );
    const id = subject.body.id;
    await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId: id, question: 'q1', answer: 'a1' })
    );
    await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId: id, question: 'q2', answer: 'a2' })
    );

    const single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${id}`));
    expect(single.body.cardCount).toBe(2);

    const list = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    const listed = list.body.data.find((s: { id: string }) => s.id === id);
    expect(listed.cardCount).toBe(2);
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

  it('reports per-subject progress (total, reviewed, due) for the list view', async () => {
    const subject = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Progress' })
    );
    const id = subject.body.id;
    const first = await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId: id, question: 'q1', answer: 'a1' })
    );
    for (const q of ['q2', 'q3']) {
      await auth(
        request(app.getHttpServer())
          .post('/v1/cards')
          .send({ subjectId: id, question: q, answer: 'a' })
      );
    }

    // Review one card well (quality 5) so it's scheduled into the future: reviewed, not due.
    await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId: first.body.id, quality: 5, timeSpent: 1000, wasHintUsed: false })
    );

    const res = await auth(request(app.getHttpServer()).get('/v1/subjects/progress'));
    expect(res.status).toBe(200);
    const entry = res.body.data.find((p: { subjectId: string }) => p.subjectId === id);
    // 3 cards total, 1 reviewed (now scheduled ahead), 2 never-reviewed are still due.
    expect(entry).toEqual({ subjectId: id, total: 3, reviewed: 1, due: 2 });
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
