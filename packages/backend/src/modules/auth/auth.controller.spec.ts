import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '../../db/schema';
import { createTestApp } from '../../test-support/create-test-app';

let app: NestFastifyApplication;
let db: Awaited<ReturnType<typeof createTestApp>>['db'];

async function signup(body: Record<string, unknown>) {
  return request(app.getHttpServer()).post('/v1/auth/signup').send(body);
}

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await db.delete(users);
});

describe('POST /v1/auth/signup', () => {
  it('creates a user and returns the user + token (no password hash)', async () => {
    const res = await signup({ email: 'a@b.com', password: 'password123', username: 'alice' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'a@b.com',
      username: 'alice',
      language: 'en',
      theme: 'light',
      dailyGoal: 20,
    });
    expect(res.body.user.id).toEqual(expect.any(String));
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with 400 auth.emailAlreadyExists', async () => {
    await signup({ email: 'dupe@b.com', password: 'password123', username: 'first' });
    const res = await signup({ email: 'dupe@b.com', password: 'password123', username: 'second' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { type: 'invalid_request_error', code: 'auth.emailAlreadyExists', param: 'email' },
    });
  });

  it('rejects invalid input with 400 errors.validation and the offending param', async () => {
    const res = await signup({ email: 'not-an-email', password: 'short', username: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('invalid_request_error');
    expect(res.body.error.code).toBe('errors.validation');
    expect(res.body.error.param).toBeDefined();
  });
});

describe('POST /v1/auth/login', () => {
  it('returns the user + token for valid credentials', async () => {
    await signup({ email: 'login@b.com', password: 'password123', username: 'bob' });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'login@b.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('login@b.com');
  });

  it('rejects a wrong password with 401 auth.invalidCredentials', async () => {
    await signup({ email: 'login2@b.com', password: 'password123', username: 'bob' });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'login2@b.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { type: 'authentication_error', code: 'auth.invalidCredentials' },
    });
  });

  it('rejects an unknown email with 401 auth.invalidCredentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'nobody@b.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.invalidCredentials');
  });
});

describe('GET/PATCH /v1/me', () => {
  async function authedToken() {
    const res = await signup({ email: 'me@b.com', password: 'password123', username: 'carol' });
    return res.body.token as string;
  }

  it('returns 401 authentication_error when no token is provided', async () => {
    const res = await request(app.getHttpServer()).get('/v1/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { type: 'authentication_error', code: 'auth.missingToken' },
    });
  });

  it('returns 401 auth.invalidToken for a malformed token', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.invalidToken');
  });

  it('returns the current user for a valid token', async () => {
    const token = await authedToken();

    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@b.com');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('updates preferences via PATCH /v1/me', async () => {
    const token = await authedToken();

    const res = await request(app.getHttpServer())
      .patch('/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', dailyGoal: 50, language: 'pt' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ theme: 'dark', dailyGoal: 50, language: 'pt' });
  });
});
