import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * Advertise that this server owns the on-disk PGlite dir by writing `<dir>.lock` with our PID.
 * The explicit `db:migrate:dev` / `db:repair` scripts read this and REFUSE to run while a live
 * server holds it — that script-vs-server concurrency is what corrupts the embedded store. The
 * server itself only advertises (it overwrites, never throws) so a `nest --watch` restart that
 * briefly overlaps processes can't crash-loop the boot. Returns a release function.
 */
export function acquireDevLock(dataDir: string): () => void {
  const lockPath = `${dataDir}.lock`;
  writeFileSync(lockPath, String(process.pid));
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      if (existsSync(lockPath) && Number(readFileSync(lockPath, 'utf8').trim()) === process.pid) {
        rmSync(lockPath, { force: true });
      }
    } catch {
      // best-effort cleanup
    }
  };
  process.once('exit', release);
  return release;
}

export interface DatabaseOptions {
  /** Real Postgres connection string (production, E2E, or local override). */
  url?: string;
  /** PGlite data dir for zero-setup local dev when no `url` is given. */
  path?: string;
  /**
   * Apply pending migrations on connect (default true). The dev watch server runs with this
   * false (via `DB_AUTO_MIGRATE=false`) so hot-reloads never run DDL — migrations are applied
   * once by the explicit `db:migrate:dev` step (also run on `pnpm dev` startup). Tests and the
   * OpenAPI generator always migrate their throwaway in-memory database.
   */
  migrate?: boolean;
}

/**
 * Real Postgres via `pg` when a `url` is provided; otherwise an embedded Postgres
 * (PGlite) so local dev needs no database server. Both run the same migrations.
 */
export async function createDatabase(options: DatabaseOptions): Promise<DatabaseHandle> {
  const shouldMigrate = options.migrate ?? true;
  if (options.url) {
    const pool = new Pool({ connectionString: options.url });
    const db = drizzlePg(pool, { schema });
    if (shouldMigrate) await migratePg(db, { migrationsFolder: migrationsFolder() });
    return { db, close: () => pool.end() };
  }

  const dataDir = options.path && options.path !== ':memory:' ? resolve(options.path) : undefined;
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  // Guard against a second process opening the same on-disk PGlite dir (corrupts it).
  const release = dataDir ? acquireDevLock(dataDir) : () => {};
  try {
    const handle = await pgliteHandle(new PGlite(dataDir), shouldMigrate);
    return {
      db: handle.db,
      close: async () => {
        release();
        await handle.close();
      },
    };
  } catch (e) {
    release();
    throw e;
  }
}

/** In-memory embedded Postgres for the test suite. */
export async function createTestDatabase(): Promise<DatabaseHandle> {
  return pgliteHandle(new PGlite(), true);
}

async function pgliteHandle(client: PGlite, shouldMigrate: boolean): Promise<DatabaseHandle> {
  await client.waitReady;
  const db = drizzlePglite(client as never, { schema }) as unknown as DrizzleDB;
  if (shouldMigrate) {
    await migratePglite(db as unknown as PgliteDatabase<typeof schema>, {
      migrationsFolder: migrationsFolder(),
    });
  }
  return { db, close: () => client.close() };
}
