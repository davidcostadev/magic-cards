import { Global, Module } from '@nestjs/common';
import { createDatabase, DRIZZLE, type DrizzleDB, runMigrations } from './client';

/**
 * Provides the singleton Drizzle instance app-wide under the {@link DRIZZLE} token.
 * Migrations run once at boot (idempotent). Tests override the DRIZZLE provider with
 * a throwaway in-memory database, so this factory never runs under test.
 */
@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (): DrizzleDB => {
        const path = process.env.DATABASE_PATH ?? './data/magic-cards.db';
        const { db } = createDatabase(path);
        runMigrations(db);
        return db;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
