import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { createDatabase, DRIZZLE, type DrizzleDB, runMigrations } from '../db/client';

export interface TestApp {
  app: NestFastifyApplication;
  db: DrizzleDB;
}

/** Boots the full Nest app against a fresh in-memory, migrated SQLite database. */
export async function createTestApp(): Promise<TestApp> {
  process.env.JWT_SECRET = 'test-secret';
  const { db } = createDatabase(':memory:');
  runMigrations(db);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DRIZZLE)
    .useValue(db)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, db };
}

/** Signs up a user and returns the bearer token for authenticating later requests. */
export async function signupAndToken(
  app: NestFastifyApplication,
  email = 'user@test.com',
  username = 'user'
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .send({ email, password: 'password123', username });
  return res.body.token as string;
}
