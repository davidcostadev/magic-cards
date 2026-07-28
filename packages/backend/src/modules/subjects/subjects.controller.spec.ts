import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_USER_ID } from '../../common/visibility';
import { subjects, users } from '../../db/schema';
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
    // Creating a subject auto-adds it to the creator's list, so it comes back selected.
    expect(res.body).toMatchObject({
      title: 'TypeScript',
      color: '#3178c6',
      cardCount: 0,
      selected: true,
    });
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

    // Regression: the `selected` flag must not fan out the cards join and inflate cardCount.
    const single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${id}`));
    expect(single.body.cardCount).toBe(2);
    expect(single.body.selected).toBe(true);

    const list = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    const listed = list.body.data.find((s: { id: string }) => s.id === id);
    expect(listed.cardCount).toBe(2);
    expect(listed.selected).toBe(true);
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
      totalReviews: 0,
      accuracy: 0,
      avgEaseFactor: null,
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
    expect(entry).toEqual({
      subjectId: id,
      total: 3,
      reviewed: 1,
      due: 2,
      mastered: 0,
      totalReviews: 1,
      accuracy: 100,
    });
  });

  it('returns per-card stats for the subject in one request', async () => {
    const subject = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Card stats' })
    );
    const id = subject.body.id;
    const studied = await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId: id, question: 'studied', answer: 'a' })
    );
    await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId: id, question: 'untouched', answer: 'a' })
    );
    await auth(
      request(app.getHttpServer())
        .post('/v1/reviews')
        .send({ cardId: studied.body.id, quality: 1, timeSpent: 4000, wasHintUsed: true })
    );

    const res = await auth(request(app.getHttpServer()).get(`/v1/subjects/${id}/card-stats`));

    expect(res.status).toBe(200);
    // Only the studied card gets a row — never-studied cards are omitted.
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      cardId: studied.body.id,
      totalReviews: 1,
      correctCount: 0,
      incorrectCount: 1,
      accuracy: 0,
      avgTimeMs: 4000,
      hintedCount: 1,
    });
    expect(res.body.data[0].easeFactor).toEqual(expect.any(Number));
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

describe('Subject selection (My Subjects list)', () => {
  it('toggles a subject in/out of the list, idempotently', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Toggle' })
    );
    const id = created.body.id;
    expect(created.body.selected).toBe(true); // auto-selected on create

    // Remove it from the list.
    const off = await auth(request(app.getHttpServer()).delete(`/v1/subjects/${id}/selection`));
    expect(off.status).toBe(204);
    let single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${id}`));
    expect(single.body.selected).toBe(false);

    // Removing again is a no-op (still 204).
    const offAgain = await auth(
      request(app.getHttpServer()).delete(`/v1/subjects/${id}/selection`)
    );
    expect(offAgain.status).toBe(204);

    // Add it back.
    const on = await auth(request(app.getHttpServer()).post(`/v1/subjects/${id}/selection`));
    expect(on.status).toBe(204);
    single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${id}`));
    expect(single.body.selected).toBe(true);

    // Adding again is idempotent (still 204, still selected once).
    const onAgain = await auth(request(app.getHttpServer()).post(`/v1/subjects/${id}/selection`));
    expect(onAgain.status).toBe(204);
    single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${id}`));
    expect(single.body.selected).toBe(true);
  });

  it("returns 404 when selecting another user's subject", async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Mine' })
    );
    const otherToken = await signupAndToken(app, 'other2@test.com', 'other2');

    const res = await request(app.getHttpServer())
      .post(`/v1/subjects/${created.body.id}/selection`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('subjects.notFound');
  });

  it('lets a user select/unselect a public catalog subject', async () => {
    // Seed a public (catalog) subject owned by the system user.
    await db.insert(users).values({
      id: SYSTEM_USER_ID,
      email: 'system@magic.cards',
      passwordHash: 'x',
      username: 'system',
    });
    const [pub] = await db
      .insert(subjects)
      .values({ userId: SYSTEM_USER_ID, isPublic: true, title: 'Public Catalog' })
      .returning();

    // Visible to the user, but not in their list yet.
    const list = await auth(request(app.getHttpServer()).get('/v1/subjects'));
    const seen = list.body.data.find((s: { id: string }) => s.id === pub.id);
    expect(seen).toBeDefined();
    expect(seen.selected).toBe(false);

    expect(
      (await auth(request(app.getHttpServer()).post(`/v1/subjects/${pub.id}/selection`))).status
    ).toBe(204);
    let single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${pub.id}`));
    expect(single.body.selected).toBe(true);

    expect(
      (await auth(request(app.getHttpServer()).delete(`/v1/subjects/${pub.id}/selection`))).status
    ).toBe(204);
    single = await auth(request(app.getHttpServer()).get(`/v1/subjects/${pub.id}`));
    expect(single.body.selected).toBe(false);
  });
});
