import { z } from 'zod';

/**
 * Environment schema, validated once at startup by ConfigModule (`validate`). The app
 * fails fast on invalid/missing config. In production a real Postgres `DATABASE_URL` and
 * a `JWT_SECRET` are mandatory; locally they're optional (PGlite + a dev secret).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().url().optional(),
    DATABASE_PATH: z.string().default('./data/pg'),
    JWT_SECRET: z.string().min(1).optional(),
    JWT_EXPIRATION: z.string().default('24h'),
    CORS_ORIGIN: z.string().default('http://localhost:5000,http://localhost:5173'),
    // Publishes public catalog content via /v1/catalog/*. Unset → catalog disabled.
    CONTENT_API_KEY: z.string().min(16).optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return;
    if (!cfg.JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'required in production' });
    }
    if (!cfg.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'required in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
