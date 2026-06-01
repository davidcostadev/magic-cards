import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { SYSTEM_USER_ID } from '../common/visibility';
import type { Env } from '../config/env';
import { DRIZZLE, type DrizzleDB } from '../db/client';
import { type CardChoice, type CardType, cards, type MatchPair, subjects } from '../db/schema';
import { buildPayload } from '../modules/cards/card-mapper';

/**
 * Seeds the public catalog (subjects + cards of every type) owned by the system user,
 * from `catalog-content.json`. Visible read-only to every learner.
 *
 * Idempotent: each row carries the dataset's stable id and is upserted, so re-running
 * converges to the file's content — it never duplicates. Run with:
 *   pnpm --filter backend seed:catalog
 *
 * Dev (PGlite) note: the embedded Postgres is single-connection, so stop the dev backend
 * first or it will hold the data dir lock. With a real DATABASE_URL it runs concurrently.
 */

interface SeedSubject {
  id: string;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface SeedCard {
  id: string;
  subjectId: string;
  type: CardType;
  question: string;
  answer?: string;
  hints?: string[];
  tags?: string[];
  choices?: CardChoice[];
  shortAnswer?: string;
  matchPairs?: MatchPair[];
}

interface CatalogContent {
  subjects: SeedSubject[];
  cards: SeedCard[];
}

// Placeholder subjects from the earlier curated seed — removed so the catalog is exactly the dataset.
const LEGACY_SUBJECT_IDS = [
  '01900000-0000-7000-8000-0000000000a0',
  '01900000-0000-7000-8000-0000000000b0',
];

function loadContent(): CatalogContent {
  const file = resolve(process.cwd(), 'src/scripts/catalog-content.json');
  return JSON.parse(readFileSync(file, 'utf8')) as CatalogContent;
}

async function seed(): Promise<void> {
  const logger = new Logger('seed:catalog');
  // Quiet bootstrap (errors/warnings still surface); the summary prints via console.log.
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const config = ctx.get<ConfigService<Env, true>>(ConfigService);
    if (
      config.get('NODE_ENV', { infer: true }) === 'production' &&
      process.env.SEED_FORCE !== '1'
    ) {
      logger.error('Refusing to seed in production without SEED_FORCE=1.');
      process.exitCode = 1;
      return;
    }

    const { subjects: seedSubjects, cards: seedCards } = loadContent();
    // The system user (owner of all public content) is ensured by CatalogService.onModuleInit.
    const db = ctx.get<DrizzleDB>(DRIZZLE);
    const now = new Date().toISOString();

    // Drop the legacy placeholder subjects (cascades to their cards) so the catalog is just the dataset.
    await db.delete(subjects).where(inArray(subjects.id, LEGACY_SUBJECT_IDS));

    for (const s of seedSubjects) {
      const values = {
        title: s.title,
        description: s.description ?? null,
        color: s.color ?? null,
        icon: s.icon ?? null,
        isPublic: true,
        updatedAt: now,
      };
      await db
        .insert(subjects)
        .values({ id: s.id, userId: SYSTEM_USER_ID, ...values })
        .onConflictDoUpdate({ target: subjects.id, set: values });
    }

    for (const c of seedCards) {
      const values = {
        subjectId: c.subjectId,
        type: c.type,
        question: c.question,
        answer: c.answer ?? '',
        payload: buildPayload(c),
        hints: c.hints ?? [],
        tags: c.tags ?? [],
        updatedAt: now,
      };
      await db
        .insert(cards)
        .values({ id: c.id, ...values })
        .onConflictDoUpdate({ target: cards.id, set: values });
    }

    const byType = seedCards.reduce<Record<string, number>>((acc, c) => {
      acc[c.type] = (acc[c.type] ?? 0) + 1;
      return acc;
    }, {});
    const breakdown = Object.entries(byType)
      .map(([t, n]) => `${t} ${n}`)
      .join(', ');
    console.log(
      `✓ Seeded ${seedSubjects.length} public subjects and ${seedCards.length} cards (${breakdown}) — idempotent.`
    );
  } finally {
    await ctx.close();
  }
}

void seed();
