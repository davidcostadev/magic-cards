import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC transforms TS with decorator metadata so NestJS DI works under Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    root: './',
    // PGlite (WASM Postgres) boots a fresh instance per suite; give hooks headroom
    // and cap fork concurrency so parallel suites don't thrash under load.
    hookTimeout: 30_000,
    testTimeout: 20_000,
    poolOptions: { forks: { maxForks: 4 } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/**/dto/**',
        'src/test-support/**',
        'src/main.ts',
        'src/openapi.ts',
        'src/app.factory.ts',
        'src/app.module.ts',
        'src/db/**',
      ],
      // Business-logic services must stay well-tested (FRD-006 #5). Branch coverage
      // is held lower because of defensive `?? default` fallbacks tests don't exercise.
      thresholds: {
        'src/modules/**/*.service.ts': {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
