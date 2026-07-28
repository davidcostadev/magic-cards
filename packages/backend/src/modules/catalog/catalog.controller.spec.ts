import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cardReports, reviewHistory, users } from '../../db/schema';
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

async function publishCard(subjectId: string, body: Record<string, unknown> = {}) {
  const res = await withKey(
    request(app.getHttpServer())
      .post('/v1/catalog/cards')
      .send({ subjectId, type: 'open', question: 'Q', answer: 'A', ...body })
  );
  return res.body as { id: string; [k: string]: unknown };
}

// Reviews/reports need a real user (FK). There's no public endpoint to author them as arbitrary
// users, so we insert directly. Each call makes a fresh user (reports are unique per user+card).
let seedSeq = 0;
async function makeUser(): Promise<string> {
  seedSeq += 1;
  const [u] = await db
    .insert(users)
    .values({ email: `seed-${seedSeq}@test.com`, passwordHash: '!', username: `seed${seedSeq}` })
    .returning();
  return u.id;
}

async function seedReview(cardId: string, subjectId: string, quality: number) {
  const userId = await makeUser();
  await db.insert(reviewHistory).values({ userId, cardId, subjectId, quality, timeSpent: 1000 });
}

async function seedReport(
  cardId: string,
  subjectId: string,
  reason: 'incorrect' | 'improvement',
  message?: string,
  extra: { suggestion?: 'add_examples'; resolved?: boolean } = {}
): Promise<string> {
  const userId = await makeUser();
  const [row] = await db
    .insert(cardReports)
    .values({
      userId,
      cardId,
      subjectId,
      reason,
      message: message ?? null,
      suggestion: extra.suggestion ?? null,
      resolved: extra.resolved ?? false,
      resolvedAt: extra.resolved ? new Date().toISOString() : null,
    })
    .returning();
  return row.id;
}

async function privateCard(email = 'owner@test.com') {
  const token = await signupAndToken(app, email, email.split('@')[0]);
  const subject = await request(app.getHttpServer())
    .post('/v1/subjects')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Private' });
  const card = await request(app.getHttpServer())
    .post('/v1/cards')
    .set('Authorization', `Bearer ${token}`)
    .send({ subjectId: subject.body.id, question: 'Private Q', answer: 'Private A' });
  return { token, id: card.body.id as string };
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

  it('persists language and translations on a single created card', async () => {
    const subject = await publishSubject();
    const created = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({
          subjectId: subject.id,
          question: 'Q',
          answer: 'A',
          language: 'pt',
          translations: { en: { question: 'Q-en', answer: 'A-en' } },
        })
    );
    expect(created.status).toBe(201);

    const detail = await withKey(
      request(app.getHttpServer()).get(`/v1/catalog/cards/${created.body.id}`)
    );
    expect(detail.body.language).toBe('pt');
    expect(detail.body.translations.en.question).toBe('Q-en');
  });
});

describe('GET /v1/catalog/cards (search / filter / rank)', () => {
  it('requires the API key (401)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/catalog/cards');
    expect(res.status).toBe(401);
  });

  it('returns only public/system cards, never a user’s private card', async () => {
    const subject = await publishSubject('Public deck');
    const pub = await publishCard(subject.id, { question: 'Public Q' });
    await privateCard();

    const res = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards'));
    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    const ids = res.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(pub.id);
    expect(res.body.data.every((c: { question: string }) => c.question !== 'Private Q')).toBe(true);
  });

  it('searches question and answer with q (case-insensitive)', async () => {
    const subject = await publishSubject();
    await publishCard(subject.id, { question: 'About CLOSURES', answer: 'x' });
    await publishCard(subject.id, { question: 'Other', answer: 'mentions hoisting' });
    await publishCard(subject.id, { question: 'Unrelated', answer: 'nope' });

    const byQuestion = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?q=closure')
    );
    expect(byQuestion.body.data).toHaveLength(1);
    const byAnswer = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?q=HOISTING')
    );
    expect(byAnswer.body.data).toHaveLength(1);
  });

  it('filters by type and language', async () => {
    const subject = await publishSubject();
    await publishCard(subject.id, { type: 'open', question: 'O', answer: 'A' });
    await publishCard(subject.id, {
      type: 'quiz',
      question: 'Quiz',
      answer: 'expl',
      choices: [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
      ],
    });
    await publishCard(subject.id, { question: 'PT card', answer: 'A', language: 'pt' });

    const quiz = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards?type=quiz'));
    expect(quiz.body.data).toHaveLength(1);
    expect(quiz.body.data[0].type).toBe('quiz');

    const pt = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards?language=pt'));
    expect(pt.body.data).toHaveLength(1);
    expect(pt.body.data[0].language).toBe('pt');
  });

  it('filters cards missing a complete translation (missing_translation=pt)', async () => {
    const subject = await publishSubject();
    const none = await publishCard(subject.id, { question: 'No tr', answer: 'A' });
    const complete = await publishCard(subject.id, {
      question: 'Has pt',
      answer: 'A',
      translations: { pt: { question: 'Tem pt', answer: 'R' } },
    });
    const partial = await publishCard(subject.id, {
      question: 'Empty pt answer',
      answer: 'A',
      translations: { pt: { question: 'P', answer: '' } },
    });

    const res = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?missing_translation=pt')
    );
    const ids = res.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(none.id);
    expect(ids).toContain(partial.id);
    expect(ids).not.toContain(complete.id);
  });

  it('computes review accuracy and report signals without join fan-out', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Stats card', answer: 'A' });
    // 4 reviews, 3 with quality >= 3 → accuracy 75, avg 3.5
    await seedReview(card.id, subject.id, 5);
    await seedReview(card.id, subject.id, 4);
    await seedReview(card.id, subject.id, 3);
    await seedReview(card.id, subject.id, 2);
    // 2 reports (1 of each reason); one already resolved.
    await seedReport(card.id, subject.id, 'incorrect');
    await seedReport(card.id, subject.id, 'improvement', undefined, { resolved: true });

    const res = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards'));
    const found = res.body.data.find((c: { id: string }) => c.id === card.id);
    expect(found.signals.reviewCount).toBe(4);
    expect(found.signals.accuracy).toBe(75);
    // 4 reviews × 2 reports would be 8 each if the joins fanned out — assert they don't.
    expect(found.signals.reportCount).toBe(2);
    expect(found.signals.openReportCount).toBe(1); // the resolved one is excluded
    expect(found.signals.reportsByReason).toEqual({ incorrect: 1, improvement: 1 });
    expect(found.signals.avgQuality).toBeCloseTo(3.5, 2);
    expect(found.signals.translations).toEqual({ en: false, pt: false });
  });

  it('filters by reported true/false and a per-reason min_reports threshold', async () => {
    const subject = await publishSubject();
    const reported = await publishCard(subject.id, { question: 'Reported', answer: 'A' });
    const clean = await publishCard(subject.id, { question: 'Clean', answer: 'A' });
    await seedReport(reported.id, subject.id, 'incorrect');
    await seedReport(reported.id, subject.id, 'incorrect');
    await seedReport(reported.id, subject.id, 'improvement');

    const onlyReported = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?reported=true')
    );
    expect(onlyReported.body.data.map((c: { id: string }) => c.id)).toEqual([reported.id]);

    const onlyClean = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?reported=false')
    );
    expect(onlyClean.body.data.map((c: { id: string }) => c.id)).toEqual([clean.id]);

    const incorrect2 = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?report_reason=incorrect&min_reports=2')
    );
    expect(incorrect2.body.data.map((c: { id: string }) => c.id)).toEqual([reported.id]);

    const improvement2 = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?report_reason=improvement&min_reports=2')
    );
    expect(improvement2.body.data).toHaveLength(0);
  });

  it('ranks by most_reported and most_reviewed', async () => {
    const subject = await publishSubject();
    const a = await publishCard(subject.id, { question: 'A', answer: 'A' });
    const b = await publishCard(subject.id, { question: 'B', answer: 'A' });
    await seedReport(b.id, subject.id, 'incorrect');
    await seedReport(b.id, subject.id, 'improvement');
    await seedReport(a.id, subject.id, 'incorrect');
    await seedReview(a.id, subject.id, 4);
    await seedReview(a.id, subject.id, 4);

    const reported = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?sort=most_reported')
    );
    expect(reported.body.data[0].id).toBe(b.id);

    const reviewed = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?sort=most_reviewed')
    );
    expect(reviewed.body.data[0].id).toBe(a.id);
  });

  it('most_wrong / most_right rank by accuracy and exclude never-reviewed cards', async () => {
    const subject = await publishSubject();
    const wrong = await publishCard(subject.id, { question: 'Wrong', answer: 'A' });
    const right = await publishCard(subject.id, { question: 'Right', answer: 'A' });
    const untouched = await publishCard(subject.id, { question: 'Untouched', answer: 'A' });
    // wrong: 1/4 correct = 25
    await seedReview(wrong.id, subject.id, 4);
    await seedReview(wrong.id, subject.id, 2);
    await seedReview(wrong.id, subject.id, 2);
    await seedReview(wrong.id, subject.id, 1);
    // right: 2/2 correct = 100
    await seedReview(right.id, subject.id, 5);
    await seedReview(right.id, subject.id, 4);

    const mw = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards?sort=most_wrong'));
    const mwIds = mw.body.data.map((c: { id: string }) => c.id);
    expect(mwIds).toEqual([wrong.id, right.id]);
    expect(mwIds).not.toContain(untouched.id);

    const mr = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards?sort=most_right'));
    expect(mr.body.data.map((c: { id: string }) => c.id)).toEqual([right.id, wrong.id]);
  });

  it('paginates with limit + offset (has_more)', async () => {
    const subject = await publishSubject();
    const c1 = await publishCard(subject.id, { question: 'one', answer: 'A' });
    const c2 = await publishCard(subject.id, { question: 'two', answer: 'A' });

    const page1 = await withKey(request(app.getHttpServer()).get('/v1/catalog/cards?limit=1'));
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.has_more).toBe(true);
    const first = page1.body.data[0].id;

    const page2 = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?limit=1&offset=1')
    );
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.has_more).toBe(false);
    const second = page2.body.data[0].id;

    expect(first).not.toBe(second);
    expect([first, second].sort()).toEqual([c1.id, c2.id].sort());
  });
});

describe('GET /v1/catalog/cards/:id (detail + reports)', () => {
  it('returns the card, signals, and anonymized report messages', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Detail Q', answer: 'A' });
    await seedReview(card.id, subject.id, 5);
    await seedReport(card.id, subject.id, 'incorrect', 'The answer is outdated');
    await seedReport(card.id, subject.id, 'improvement', 'Add an example');

    const res = await withKey(request(app.getHttpServer()).get(`/v1/catalog/cards/${card.id}`));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(card.id);
    expect(res.body.signals.reviewCount).toBe(1);
    expect(res.body.signals.reportCount).toBe(2);
    expect(res.body.reports).toHaveLength(2);
    const messages = res.body.reports.map((r: { message: string }) => r.message);
    expect(messages).toContain('The answer is outdated');
    // Anonymized: the reporter's identity is never exposed.
    expect(res.body.reports.every((r: Record<string, unknown>) => !('userId' in r))).toBe(true);
  });

  it('404 for a non-public card', async () => {
    const priv = await privateCard();
    const res = await withKey(request(app.getHttpServer()).get(`/v1/catalog/cards/${priv.id}`));
    expect(res.status).toBe(404);
  });

  it('404 for a missing id; 401 without the key', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Q', answer: 'A' });
    const missing = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards/01900000-0000-7000-8000-000000000000')
    );
    expect(missing.status).toBe(404);
    const noKey = await request(app.getHttpServer()).get(`/v1/catalog/cards/${card.id}`);
    expect(noKey.status).toBe(401);
  });

  it('exposes each report’s suggestion and resolution status', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Detail Q', answer: 'A' });
    await seedReport(card.id, subject.id, 'improvement', 'Add examples', {
      suggestion: 'add_examples',
    });

    const res = await withKey(request(app.getHttpServer()).get(`/v1/catalog/cards/${card.id}`));
    expect(res.body.signals.openReportCount).toBe(1);
    expect(res.body.reports[0]).toMatchObject({
      suggestion: 'add_examples',
      resolved: false,
      resolvedAt: null,
    });
  });
});

describe('PATCH /v1/catalog/card_reports/:id (resolve a report)', () => {
  it('marks a report resolved (sets resolvedAt) and reopens it', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Q', answer: 'A' });
    const reportId = await seedReport(card.id, subject.id, 'improvement', 'Add examples', {
      suggestion: 'add_examples',
    });

    const resolved = await withKey(
      request(app.getHttpServer())
        .patch(`/v1/catalog/card_reports/${reportId}`)
        .send({ resolved: true })
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({ id: reportId, cardId: card.id, resolved: true });
    expect(resolved.body.resolvedAt).toBeTruthy();

    // The card detail now reports zero open reports.
    const detail = await withKey(request(app.getHttpServer()).get(`/v1/catalog/cards/${card.id}`));
    expect(detail.body.signals.openReportCount).toBe(0);

    // Reopening clears resolvedAt.
    const reopened = await withKey(
      request(app.getHttpServer())
        .patch(`/v1/catalog/card_reports/${reportId}`)
        .send({ resolved: false })
    );
    expect(reopened.body).toMatchObject({ resolved: false, resolvedAt: null });
  });

  it("refuses to resolve a report on a user's private card (404)", async () => {
    const priv = await privateCard();
    // The private card's owner reports it.
    const report = await request(app.getHttpServer())
      .post('/v1/card_reports')
      .set('Authorization', `Bearer ${priv.token}`)
      .send({ cardId: priv.id, reason: 'incorrect' });

    const res = await withKey(
      request(app.getHttpServer())
        .patch(`/v1/catalog/card_reports/${report.body.id}`)
        .send({ resolved: true })
    );
    expect(res.status).toBe(404);
  });

  it('404 for a missing report id; 401 without the key', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Q', answer: 'A' });
    const reportId = await seedReport(card.id, subject.id, 'improvement');

    const missing = await withKey(
      request(app.getHttpServer())
        .patch('/v1/catalog/card_reports/01900000-0000-7000-8000-000000000000')
        .send({ resolved: true })
    );
    expect(missing.status).toBe(404);

    const noKey = await request(app.getHttpServer())
      .patch(`/v1/catalog/card_reports/${reportId}`)
      .send({ resolved: true });
    expect(noKey.status).toBe(401);
  });
});

describe('PATCH /v1/catalog/cards/:id (improve a card)', () => {
  it('adds a translation to a public card and clears the missing-translation filter', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, {
      question: 'What is a closure?',
      answer: 'fn + scope',
    });

    const res = await withKey(
      request(app.getHttpServer())
        .patch(`/v1/catalog/cards/${card.id}`)
        .send({
          translations: { pt: { question: 'O que é uma closure?', answer: 'função + escopo' } },
        })
    );
    expect(res.status).toBe(200);
    expect(res.body.translations.pt.question).toBe('O que é uma closure?');
    expect(res.body.signals.translations.pt).toBe(true);

    const missing = await withKey(
      request(app.getHttpServer()).get('/v1/catalog/cards?missing_translation=pt')
    );
    expect(missing.body.data.map((c: { id: string }) => c.id)).not.toContain(card.id);
  });

  it('updates question/answer partially', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Old', answer: 'Old A' });
    const res = await withKey(
      request(app.getHttpServer()).patch(`/v1/catalog/cards/${card.id}`).send({ answer: 'New A' })
    );
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('New A');
    expect(res.body.question).toBe('Old');
  });

  it('re-validates against the (immutable) type — a quiz must keep exactly one correct choice', async () => {
    const subject = await publishSubject();
    const quiz = await publishCard(subject.id, {
      type: 'quiz',
      question: 'Q',
      answer: 'expl',
      choices: [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
      ],
    });
    const res = await withKey(
      request(app.getHttpServer())
        .patch(`/v1/catalog/cards/${quiz.id}`)
        .send({
          choices: [
            { id: 'a', text: 'A', isCorrect: false },
            { id: 'b', text: 'B', isCorrect: false },
          ],
        })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('errors.validation');
  });

  it("refuses to patch a user's private card (404) and leaves it untouched", async () => {
    const priv = await privateCard();
    const res = await withKey(
      request(app.getHttpServer()).patch(`/v1/catalog/cards/${priv.id}`).send({ answer: 'Hacked' })
    );
    expect(res.status).toBe(404);

    const still = await request(app.getHttpServer())
      .get(`/v1/cards/${priv.id}`)
      .set('Authorization', `Bearer ${priv.token}`);
    expect(still.body.answer).toBe('Private A');
  });

  it('requires the API key (401)', async () => {
    const subject = await publishSubject();
    const card = await publishCard(subject.id, { question: 'Q', answer: 'A' });
    const res = await request(app.getHttpServer())
      .patch(`/v1/catalog/cards/${card.id}`)
      .send({ answer: 'X' });
    expect(res.status).toBe(401);
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

  it('imports a card language and round-trips it through export', async () => {
    const res = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/import')
        .send({
          subjects: [{ id: 'io-lang', title: 'Lang deck' }],
          cards: [
            {
              id: 'io-lang-c1',
              subjectId: 'io-lang',
              question: 'Pergunta',
              answer: 'Resposta',
              language: 'pt',
            },
          ],
        })
    );
    expect(res.status).toBe(200);
    expect(res.body.cards.created).toBe(1);

    const exp = await withKey(request(app.getHttpServer()).get('/v1/catalog/export'));
    const card = exp.body.cards.find((c: { id: string }) => c.id === 'io-lang-c1');
    expect(card.language).toBe('pt');
  });

  it('round-trips card translations through import/export', async () => {
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/import')
        .send({
          subjects: [{ id: 'io-tr', title: 'Translated deck' }],
          cards: [
            {
              id: 'io-tr-c1',
              subjectId: 'io-tr',
              question: 'What is a closure?',
              answer: 'A function plus scope.',
              translations: {
                pt: { question: 'O que é uma closure?', answer: 'Função + escopo.' },
              },
            },
          ],
        })
    );
    const exp = await withKey(request(app.getHttpServer()).get('/v1/catalog/export'));
    const card = exp.body.cards.find((c: { id: string }) => c.id === 'io-tr-c1');
    expect(card.translations.pt.question).toBe('O que é uma closure?');
  });

  it('defaults an imported card without a language to "en"', async () => {
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/import')
        .send({
          subjects: [{ id: 'io-def', title: 'Default deck' }],
          cards: [{ id: 'io-def-c1', subjectId: 'io-def', question: 'Q', answer: 'A' }],
        })
    );
    const exp = await withKey(request(app.getHttpServer()).get('/v1/catalog/export'));
    const card = exp.body.cards.find((c: { id: string }) => c.id === 'io-def-c1');
    expect(card.language).toBe('en');
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

  it('rejects a card whose mermaid diagram has no valid type, and keeps the good one', async () => {
    const good = 'Flow:\n\n```mermaid\ngraph TD\n  A-->B\n```';
    const bad = 'Flow:\n\n```mermaid\ngraphh TD\n  A-->B\n```';
    const res = await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/import')
        .send({
          subjects: [{ id: 'io-mmd', title: 'Diagrams' }],
          cards: [
            { id: 'mmd-ok', subjectId: 'io-mmd', question: 'Q', answer: good },
            { id: 'mmd-bad', subjectId: 'io-mmd', question: 'Q', answer: bad },
          ],
        })
    );
    expect(res.status).toBe(200);
    expect(res.body.cards.created).toBe(1);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].id).toBe('mmd-bad');
    expect(res.body.errors[0].error).toContain('answer');
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

describe('browsing public cards reveals full answers (but stays read-only)', () => {
  it('a non-owner sees answers, the correct choice, and the accepted answer via GET /v1/cards', async () => {
    const subject = await publishSubject('Public JS');
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({ subjectId: subject.id, type: 'open', question: 'Open Q', answer: 'Open A' })
    );
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({
          subjectId: subject.id,
          type: 'quiz',
          question: 'Quiz Q',
          answer: 'B wins',
          choices: [
            { id: 'a', text: 'A', isCorrect: false },
            { id: 'b', text: 'B', isCorrect: true },
          ],
        })
    );
    await withKey(
      request(app.getHttpServer()).post('/v1/catalog/cards').send({
        subjectId: subject.id,
        type: 'type-answer',
        question: 'TA Q',
        answer: 'explanation',
        shortAnswer: 'Partial',
      })
    );

    const token = await signupAndToken(app, 'reader@test.com', 'reader');
    const res = await request(app.getHttpServer())
      .get(`/v1/cards?subject=${subject.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const byQ = (q: string) => res.body.data.find((c: { question: string }) => c.question === q);

    expect(byQ('Open Q').answer).toBe('Open A');

    const quiz = byQ('Quiz Q');
    expect(quiz.answer).toBe('B wins');
    expect(quiz.choices.find((c: { id: string }) => c.id === 'b').isCorrect).toBe(true);

    const ta = byQ('TA Q');
    expect(ta.answer).toBe('explanation');
    expect(ta.shortAnswer).toBe('Partial');

    // Still read-only: a user cannot edit a public card.
    const edit = await request(app.getHttpServer())
      .patch(`/v1/cards/${quiz.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'Hacked' });
    expect(edit.status).toBe(404);
  });

  it('still sanitizes the study queue for public content (anti-spoiler)', async () => {
    const subject = await publishSubject('Public Quiz Deck');
    await withKey(
      request(app.getHttpServer())
        .post('/v1/catalog/cards')
        .send({
          subjectId: subject.id,
          type: 'quiz',
          question: 'Spoiler Q',
          answer: 'secret',
          choices: [
            { id: 'a', text: 'A', isCorrect: false },
            { id: 'b', text: 'B', isCorrect: true },
          ],
        })
    );

    const token = await signupAndToken(app, 'studier@test.com', 'studier');
    const queue = await request(app.getHttpServer())
      .get('/v1/review_queue')
      .set('Authorization', `Bearer ${token}`);
    const card = queue.body.new.find((c: { question: string }) => c.question === 'Spoiler Q');
    expect(card).toBeDefined();
    // The study payload never carries the answer or the correct marker.
    expect(card.answer).toBe('');
    expect(card.choices.every((c: { isCorrect?: boolean }) => c.isCorrect === undefined)).toBe(
      true
    );
  });
});
