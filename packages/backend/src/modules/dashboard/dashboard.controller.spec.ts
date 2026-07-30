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

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

async function seedReviewedCard() {
  const subject = await auth(
    request(app.getHttpServer()).post('/v1/subjects').send({ title: 'S' })
  );
  const card = await auth(
    request(app.getHttpServer())
      .post('/v1/cards')
      .send({ subjectId: subject.body.id, question: 'Q', answer: 'A' })
  );
  await auth(
    request(app.getHttpServer())
      .post('/v1/reviews')
      .send({ cardId: card.body.id, quality: 4, timeSpent: 1000, wasHintUsed: false })
  );
}

beforeEach(async () => {
  await db.delete(users);
  token = await signupAndToken(app, 'owner@test.com', 'owner');
});

describe('Dashboard endpoints', () => {
  it('reflects a freshly completed review in the stats', async () => {
    await seedReviewedCard();

    const res = await auth(request(app.getHttpServer()).get('/v1/dashboard/stats'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reviewedToday: 1, dailyGoal: 20 });
    expect(res.body.cardsByStatus.learning).toBe(1);
    expect(res.body.accuracy7d).toBe(100);
  });

  it('returns weak cards in the list envelope', async () => {
    await seedReviewedCard();

    const res = await auth(request(app.getHttpServer()).get('/v1/dashboard/weak_cards?limit=5'));
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data[0]).toMatchObject({ question: 'Q', subjectTitle: 'S' });
  });

  it('returns the upcoming windows', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/dashboard/upcoming'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ today: 0, tomorrow: 0, thisWeek: 0 });
  });

  it('returns the study turns in the list envelope', async () => {
    await seedReviewedCard();

    const res = await auth(request(app.getHttpServer()).get('/v1/dashboard/timeline'));
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ reviews: 1, correct: 1, accuracy: 100, mastered: 0 });
  });

  it('rejects a timeline limit outside the allowed range', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/dashboard/timeline?limit=500'));
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer()).get('/v1/dashboard/stats');
    expect(res.status).toBe(401);
  });
});
