import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

/** DI token for the Drizzle database instance. */
export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  db: DrizzleDB;
  sqlite: BetterSqlite3.Database;
}

export function createDatabase(path: string): DatabaseHandle {
  if (path !== ':memory:') {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }
  const sqlite = new BetterSqlite3(path);
  if (path !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function runMigrations(
  db: DrizzleDB,
  migrationsFolder = process.env.MIGRATIONS_DIR ?? resolve(process.cwd(), 'src/db/migrations')
): void {
  migrate(db, { migrationsFolder });
}
