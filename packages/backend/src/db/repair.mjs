/**
 * Repairs a corrupted PGlite dev database WITHOUT losing data. PGlite is a single-process
 * embedded Postgres; an interrupted migration (or two processes opening the same dir) can leave
 * its catalog inconsistent in ways plain SQL can't fix. This reads every row out of the broken
 * DB, rebuilds a fresh one from the migrations, re-inserts the data, then swaps directories
 * (the corrupt DB is kept as a timestamped backup). The corruption is left behind because we
 * copy the DATA, not the catalog.
 *
 * Run with the dev server STOPPED (PGlite needs exclusive access).
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

/** Refuse to run if another LIVE process holds the dir lock (concurrent PGlite access corrupts it). */
function acquireProcessLock(dataDir) {
  const lockPath = `${dataDir}.lock`;
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  if (existsSync(lockPath)) {
    const pid = Number(readFileSync(lockPath, 'utf8').trim());
    if (pid && pid !== process.pid && alive(pid)) {
      throw new Error(
        `Database dir "${dataDir}" is in use by another process (pid ${pid}). Stop the dev server first.`
      );
    }
  }
  writeFileSync(lockPath, String(process.pid));
  process.once('exit', () => {
    try {
      if (existsSync(lockPath) && Number(readFileSync(lockPath, 'utf8').trim()) === process.pid) {
        rmSync(lockPath, { force: true });
      }
    } catch {
      // best-effort
    }
  });
}

const path = process.env.DATABASE_PATH ?? './data/pg';
const liveDir = resolve(path);
const newDir = `${liveDir}.rebuild`;
const lock = `${liveDir}.migrating`;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `${liveDir}.corrupt-${stamp}`;
const migrationsFolder = resolve(process.cwd(), process.env.MIGRATIONS_DIR ?? 'src/db/migrations');

// Parents before children so foreign keys are satisfied on re-insert.
const ORDER = ['users', 'subjects', 'cards', 'card_progress', 'review_history'];

async function columnsOf(db, table) {
  const r = await db.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table]
  );
  return r.rows.map((row) => row.column_name);
}

async function readAll() {
  const old = new PGlite(liveDir);
  await old.waitReady;
  const data = {};
  for (const table of ORDER) {
    const cols = await columnsOf(old, table);
    if (cols.length === 0) {
      data[table] = { cols: [], rows: [] };
      continue;
    }
    const r = await old.query(`select ${cols.map((c) => `"${c}"`).join(', ')} from "${table}"`);
    data[table] = { cols, rows: r.rows };
  }
  await old.close();
  return data;
}

async function insertRows(client, table, rows) {
  for (const row of rows) {
    const cols = Object.keys(row);
    const params = [];
    const placeholders = cols.map((c, i) => {
      const v = row[c];
      if (v !== null && typeof v === 'object') {
        // jsonb columns (payload / hints / tags) come back as JS values.
        params.push(JSON.stringify(v));
        return `$${i + 1}::jsonb`;
      }
      params.push(v);
      return `$${i + 1}`;
    });
    await client.query(
      `insert into "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) values (${placeholders.join(', ')})`,
      params
    );
  }
}

acquireProcessLock(liveDir);

const data = await readAll();
console.log('read:', Object.fromEntries(ORDER.map((t) => [t, data[t].rows.length])));

if (existsSync(newDir)) rmSync(newDir, { recursive: true, force: true });
const fresh = new PGlite(newDir);
await fresh.waitReady;
await migrate(drizzle(fresh), { migrationsFolder });
// Columns added by later migrations but absent in the old data take their schema default.
for (const table of ORDER) await insertRows(fresh, table, data[table].rows);

const verify = {};
for (const table of ORDER) {
  const r = await fresh.query(`select count(*)::int as n from "${table}"`);
  verify[table] = r.rows[0].n;
}
await fresh.close();
console.log('rebuilt:', verify);

if (!ORDER.every((t) => verify[t] === data[t].rows.length)) {
  console.error(`Row counts differ — leaving the live DB untouched. Inspect ${newDir} manually.`);
  process.exit(1);
}

renameSync(liveDir, backupDir);
renameSync(newDir, liveDir);
if (existsSync(lock)) rmSync(lock, { force: true });
console.log(`\nRepaired. Corrupt DB backed up at: ${backupDir}`);
console.log('Delete the backup once you have confirmed the app works.');
