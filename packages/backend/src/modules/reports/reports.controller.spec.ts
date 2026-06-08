import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cardReports, subjects, users } from '../../db/schema';
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

function auth(req: request.Test, t = token) {
  return req.set('Authorization', `Bearer ${t}`);
}

async function addCard(question: string, subject = subjectId): Promise<string> {
  const res = await auth(
    request(app.getHttpServer())
      .post('/v1/cards')
      .send({ subjectId: subject, question, answer: 'a' })
  );
  return res.body.id;
}

/** Creates a subject + card owned by a second user, then publishes it (catalog-style). */
async function addPublicCard(): Promise<{ cardId: string; subjectId: string; otherToken: string }> {
  const otherToken = await signupAndToken(app, 'author@test.com', 'author');
  const subject = await auth(
    request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Public' }),
    otherToken
  );
  const card = await auth(
    request(app.getHttpServer())
      .post('/v1/cards')
      .send({ subjectId: subject.body.id, question: 'Shared Q', answer: 'a' }),
    otherToken
  );
  await db.update(subjects).set({ isPublic: true }).where(eq(subjects.id, subject.body.id));
  return { cardId: card.body.id, subjectId: subject.body.id, otherToken };
}

beforeEach(async () => {
  await db.delete(users);
  token = await signupAndToken(app, 'owner@test.com', 'owner');
  const subject = await auth(
    request(app.getHttpServer()).post('/v1/subjects').send({ title: 'S' })
  );
  subjectId = subject.body.id;
});

describe('POST /v1/card_reports', () => {
  it("files a report on the user's own card", async () => {
    const cardId = await addCard('Q1');
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'incorrect', message: 'The answer is wrong' })
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      cardId,
      subjectId,
      reason: 'incorrect',
      message: 'The answer is wrong',
    });
  });

  it('allows reporting a shared/public card the user does not own', async () => {
    const { cardId } = await addPublicCard();
    const res = await auth(
      request(app.getHttpServer()).post('/v1/card_reports').send({ cardId, reason: 'improvement' })
    );

    expect(res.status).toBe(201);
    expect(res.body.reason).toBe('improvement');
    expect(res.body.message).toBeNull();
  });

  it("returns 404 reporting another user's private card", async () => {
    const otherToken = await signupAndToken(app, 'other@test.com', 'other');
    const otherSubject = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Theirs' }),
      otherToken
    );
    const card = await auth(
      request(app.getHttpServer())
        .post('/v1/cards')
        .send({ subjectId: otherSubject.body.id, question: 'Hidden', answer: 'a' }),
      otherToken
    );

    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId: card.body.id, reason: 'incorrect' })
    );
    expect(res.status).toBe(404);
  });

  it('updates the existing report when the same card is reported again', async () => {
    const cardId = await addCard('Q1');
    await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'incorrect', message: 'first' })
    );
    await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'improvement', message: 'second' })
    );

    const list = await auth(request(app.getHttpServer()).get('/v1/card_reports'));
    expect(list.body.data).toHaveLength(1); // upsert, not a second row
    expect(list.body.data[0]).toMatchObject({ reason: 'improvement', message: 'second' });
  });

  it('rejects an unknown reason with 400', async () => {
    const cardId = await addCard('Q1');
    const res = await auth(
      request(app.getHttpServer()).post('/v1/card_reports').send({ cardId, reason: 'spam' })
    );
    expect(res.status).toBe(400);
  });

  it('stores a structured suggestion and defaults resolved to false', async () => {
    const cardId = await addCard('Q1');
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'improvement', suggestion: 'add_examples' })
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      reason: 'improvement',
      suggestion: 'add_examples',
      resolved: false,
      resolvedAt: null,
    });
  });

  it('rejects an unknown suggestion with 400', async () => {
    const cardId = await addCard('Q1');
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'improvement', suggestion: 'rewrite_everything' })
    );
    expect(res.status).toBe(400);
  });

  it('reopens a resolved report when the same card is reported again', async () => {
    const cardId = await addCard('Q1');
    const created = await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'improvement', suggestion: 'add_examples' })
    );
    // Mark it resolved out-of-band (the catalog side does this after a fix).
    await db
      .update(cardReports)
      .set({ resolved: true, resolvedAt: new Date().toISOString() })
      .where(eq(cardReports.id, created.body.id));

    const reagain = await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId, reason: 'incorrect', message: 'still wrong' })
    );
    expect(reagain.body).toMatchObject({ resolved: false, resolvedAt: null, suggestion: null });
  });
});

describe('GET /v1/card_reports', () => {
  it("lists only the user's own reports and scopes them to a subject", async () => {
    const a = await addCard('Q in S');
    await auth(
      request(app.getHttpServer()).post('/v1/card_reports').send({ cardId: a, reason: 'incorrect' })
    );

    // A second subject with its own reported card.
    const other = await auth(
      request(app.getHttpServer()).post('/v1/subjects').send({ title: 'Other' })
    );
    const b = await addCard('Q in Other', other.body.id);
    await auth(
      request(app.getHttpServer())
        .post('/v1/card_reports')
        .send({ cardId: b, reason: 'improvement' })
    );

    const all = await auth(request(app.getHttpServer()).get('/v1/card_reports'));
    expect(all.body.data).toHaveLength(2);

    const scoped = await auth(
      request(app.getHttpServer()).get('/v1/card_reports').query({ subject: subjectId })
    );
    expect(scoped.body.data).toHaveLength(1);
    expect(scoped.body.data[0].cardId).toBe(a);
  });

  it("does not expose another user's reports", async () => {
    const { cardId } = await addPublicCard();
    await auth(
      request(app.getHttpServer()).post('/v1/card_reports').send({ cardId, reason: 'incorrect' })
    );

    const stranger = await signupAndToken(app, 'stranger@test.com', 'stranger');
    const res = await auth(request(app.getHttpServer()).get('/v1/card_reports'), stranger);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('DELETE /v1/card_reports/:id', () => {
  it("withdraws the user's own report", async () => {
    const cardId = await addCard('Q1');
    const created = await auth(
      request(app.getHttpServer()).post('/v1/card_reports').send({ cardId, reason: 'incorrect' })
    );

    const del = await auth(
      request(app.getHttpServer()).delete(`/v1/card_reports/${created.body.id}`)
    );
    expect(del.status).toBe(204);

    const list = await auth(request(app.getHttpServer()).get('/v1/card_reports'));
    expect(list.body.data).toHaveLength(0);
  });

  it("returns 404 deleting a report that isn't the user's", async () => {
    const { cardId, otherToken } = await addPublicCard();
    const created = await auth(
      request(app.getHttpServer()).post('/v1/card_reports').send({ cardId, reason: 'incorrect' }),
      otherToken
    );

    const res = await auth(
      request(app.getHttpServer()).delete(`/v1/card_reports/${created.body.id}`)
    );
    expect(res.status).toBe(404);
  });
});
