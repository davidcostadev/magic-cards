import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SYSTEM_USER_ID } from '../common/visibility';
import type { Env } from '../config/env';
import { DRIZZLE, type DrizzleDB } from '../db/client';
import { cards, subjects } from '../db/schema';

/**
 * Seeds example public catalog content (subjects + cards) owned by the system user.
 *
 * Idempotent: every row carries a fixed id and is upserted, so re-running converges
 * to the content defined here — it never duplicates. Run with:  pnpm --filter backend seed:catalog
 *
 * Dev (PGlite) note: the embedded Postgres is single-connection, so stop the dev backend
 * first or it will hold the data dir lock. With a real DATABASE_URL it runs concurrently.
 */

interface SeedCard {
  id: string;
  question: string;
  answer: string;
  hints?: string[];
  tags?: string[];
}

interface SeedSubject {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  cards: SeedCard[];
}

// Fixed UUIDs so upserts target stable rows across runs.
const CATALOG: SeedSubject[] = [
  {
    id: '01900000-0000-7000-8000-0000000000a0',
    title: 'Git Essentials',
    description: 'Everyday Git commands and concepts.',
    color: '#f05133',
    icon: 'git-branch',
    cards: [
      {
        id: '01900000-0000-7000-8000-0000000000a1',
        question: 'What does `git stash` do?',
        answer:
          'Saves your uncommitted changes (staged and unstaged) onto a stack and reverts the working tree to `HEAD`, so you can switch context. Restore them later with `git stash pop`.',
        hints: ['Think of a temporary shelf for work in progress.'],
        tags: ['git', 'workflow'],
      },
      {
        id: '01900000-0000-7000-8000-0000000000a2',
        question: 'Difference between `git merge` and `git rebase`?',
        answer:
          '`merge` creates a new merge commit joining two histories (non-destructive, preserves branch topology). `rebase` rewrites your commits on top of another base for a **linear** history. Never rebase commits that are already pushed and shared.',
        tags: ['git', 'history'],
      },
      {
        id: '01900000-0000-7000-8000-0000000000a3',
        question: 'How do you undo the *last* commit but keep the changes staged?',
        answer:
          '`git reset --soft HEAD~1` — moves `HEAD` back one commit, leaving the changes staged.',
        hints: ['`--soft` keeps the index; `--hard` would discard everything.'],
        tags: ['git', 'undo'],
      },
    ],
  },
  {
    id: '01900000-0000-7000-8000-0000000000b0',
    title: 'HTTP Status Codes',
    description: 'The status codes every web developer should know.',
    color: '#2563eb',
    icon: 'globe',
    cards: [
      {
        id: '01900000-0000-7000-8000-0000000000b1',
        question: 'What does **201 Created** mean, and how does it differ from 200?',
        answer:
          '`201 Created` confirms a request succeeded **and** a new resource was created (typically from a `POST`). A `Location` header should point to the new resource. `200 OK` is generic success without the create semantics.',
        tags: ['http', 'rest'],
      },
      {
        id: '01900000-0000-7000-8000-0000000000b2',
        question: 'When should an API return **401** vs **403**?',
        answer:
          '`401 Unauthorized` means *not authenticated* — no/invalid credentials (the client should authenticate). `403 Forbidden` means *authenticated but not allowed*. Tip: some APIs return `404` instead of `403` to avoid leaking that a resource exists.',
        hints: ['401 = who are you? · 403 = I know who you are, still no.'],
        tags: ['http', 'auth'],
      },
      {
        id: '01900000-0000-7000-8000-0000000000b3',
        question: 'What category is **3xx**, and give a common example?',
        answer:
          '`3xx` = redirection. Example: `301 Moved Permanently` (the resource has a new permanent URL) vs `302 Found` / `307 Temporary Redirect` for temporary moves.',
        tags: ['http'],
      },
    ],
  },
];

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

    // The system user (owner of all public content) is ensured by CatalogService.onModuleInit.
    const db = ctx.get<DrizzleDB>(DRIZZLE);
    const now = new Date().toISOString();
    let subjectCount = 0;
    let cardCount = 0;

    for (const s of CATALOG) {
      await db
        .insert(subjects)
        .values({
          id: s.id,
          userId: SYSTEM_USER_ID,
          isPublic: true,
          title: s.title,
          description: s.description,
          color: s.color,
          icon: s.icon,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: subjects.id,
          set: {
            title: s.title,
            description: s.description,
            color: s.color,
            icon: s.icon,
            isPublic: true,
            updatedAt: now,
          },
        });
      subjectCount += 1;

      for (const c of s.cards) {
        await db
          .insert(cards)
          .values({
            id: c.id,
            subjectId: s.id,
            question: c.question,
            answer: c.answer,
            hints: c.hints ?? [],
            tags: c.tags ?? [],
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: cards.id,
            set: {
              question: c.question,
              answer: c.answer,
              hints: c.hints ?? [],
              tags: c.tags ?? [],
              updatedAt: now,
            },
          });
        cardCount += 1;
      }
    }

    console.log(`✓ Seeded ${subjectCount} public subjects and ${cardCount} cards (idempotent).`);
  } finally {
    await ctx.close();
  }
}

void seed();
