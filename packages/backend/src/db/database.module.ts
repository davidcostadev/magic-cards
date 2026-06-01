import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { createDatabase, type DatabaseHandle, DB_HANDLE, DRIZZLE } from './client';

/**
 * Provides the singleton Drizzle instance app-wide under the {@link DRIZZLE} token and
 * closes the connection on shutdown. Tests override DB_HANDLE/DRIZZLE with a PGlite db.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_HANDLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Promise<DatabaseHandle> =>
        createDatabase({
          url: config.get('DATABASE_URL', { infer: true }),
          path: config.get('DATABASE_PATH', { infer: true }),
        }),
    },
    {
      provide: DRIZZLE,
      inject: [DB_HANDLE],
      useFactory: (handle: DatabaseHandle) => handle.db,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DB_HANDLE) private readonly handle: DatabaseHandle) {}

  onModuleDestroy(): Promise<void> {
    return this.handle.close();
  }
}
