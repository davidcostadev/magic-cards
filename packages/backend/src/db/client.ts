import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

/** DI tokens for the Drizzle instance and its underlying handle (for shutdown). */
export const DRIZZLE = Symbol('DRIZZLE');
export const DB_HANDLE = Symbol('DB_HANDLE');

// PGlite and node-postgres share the same query API; services type against this.
export type DrizzleDB = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  db: DrizzleDB;
  close: () => Promise<void>;
}

function migrationsFolder(): string {
  return process.env.MIGRATIONS_DIR ?? resolve(process.cwd(), 'src/db/migrations');
}

export interface DatabaseOptions {
  /** Real Postgres connection string (production, E2E, or local override). */
  url?: string;
  /** PGlite data dir for zero-setup local dev when no `url` is given. */
  path?: string;
}

/**
 * Real Postgres via `pg` when a `url` is provided; otherwise an embedded Postgres
 * (PGlite) so local dev needs no database server. Both run the same migrations.
 */
export async function createDatabase(options: DatabaseOptions): Promise<DatabaseHandle> {
  if (options.url) {
    const pool = new Pool({ connectionString: options.url });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: migrationsFolder() });
    return { db, close: () => pool.end() };
  }

  const dataDir = options.path && options.path !== ':memory:' ? resolve(options.path) : undefined;
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  return pgliteHandle(new PGlite(dataDir));
}

/** In-memory embedded Postgres for the test suite. */
export async function createTestDatabase(): Promise<DatabaseHandle> {
  return pgliteHandle(new PGlite());
}

async function pgliteHandle(client: PGlite): Promise<DatabaseHandle> {
  await client.waitReady;
  const db = drizzlePglite(client as never, { schema }) as unknown as DrizzleDB;
  await migratePglite(db as unknown as PgliteDatabase<typeof schema>, {
    migrationsFolder: migrationsFolder(),
  });
  return { db, close: () => client.close() };
}
