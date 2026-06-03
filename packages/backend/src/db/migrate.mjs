/**
 * Applies pending migrations to the configured database — an EXPLICIT step, deliberately kept
 * off the dev server's hot-reload path so a watcher restart can never interrupt a migration.
 *
 *   - PGlite dev DB (no DATABASE_URL): a sibling lockfile (`<dir>.migrating`) is written before
 *     migrating and removed on a clean finish. If a run is hard-killed mid-migration the lock
 *     survives, so the next run fails fast with guidance (run `db:repair`) instead of corrupting
 *     the catalog silently.
 *   - Real Postgres (DATABASE_URL set): migrates via node-postgres (transactional, no lock needed).
 *
 * Run with the dev server STOPPED — two processes opening the same PGlite dir corrupts it.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsFolder = resolve(process.cwd(), process.env.MIGRATIONS_DIR ?? 'src/db/migrations');

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Refuse to open the dir if another LIVE process holds `<dir>.lock` (concurrent access corrupts PGlite). */
function acquireProcessLock(dataDir) {
  const lockPath = `${dataDir}.lock`;
  if (existsSync(lockPath)) {
    const pid = Number(readFileSync(lockPath, 'utf8').trim());
    if (pid && pid !== process.pid && pidAlive(pid)) {
      throw new Error(
        `Database dir "${dataDir}" is in use by another process (pid ${pid}). ` +
          'Stop the dev server before running migrations.'
      );
    }
  }
  writeFileSync(lockPath, String(process.pid));
  return () => {
    try {
      if (existsSync(lockPath) && Number(readFileSync(lockPath, 'utf8').trim()) === process.pid) {
        rmSync(lockPath, { force: true });
      }
    } catch {
      // best-effort
    }
  };
}

async function migrateUrl(url) {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

async function migratePgliteDir(path) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');

  const dataDir = path && path !== ':memory:' ? resolve(path) : undefined;
  const releaseProcessLock = dataDir ? acquireProcessLock(dataDir) : () => {};
  try {
    const lock = dataDir ? `${dataDir}.migrating` : undefined;
    if (lock && existsSync(lock)) {
      throw new Error(
        `Migration lock present (${lock}): a previous migration did not finish, so the dev ` +
          'database may be inconsistent.\n' +
          'Fix it with "pnpm --filter backend db:repair" (rebuilds clean, preserves data), ' +
          `or delete ${dataDir} to reset — then retry.`
      );
    }
    if (dataDir) mkdirSync(dataDir, { recursive: true });

    const client = new PGlite(dataDir);
    await client.waitReady;
    if (lock) writeFileSync(lock, new Date().toISOString());
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client.close();
      // Removed on a clean finish (incl. normal errors). A hard kill (SIGKILL) skips this, leaving
      // the lock so the next run is warned — exactly the interrupted-migration case we guard against.
      if (lock) rmSync(lock, { force: true });
    }
  } finally {
    releaseProcessLock();
  }
}

const url = process.env.DATABASE_URL;
if (url) {
  await migrateUrl(url);
} else {
  await migratePgliteDir(process.env.DATABASE_PATH ?? './data/pg');
}
process.stdout.write('Migrations applied.\n');
