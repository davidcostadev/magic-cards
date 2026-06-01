# ADR 0006: PostgreSQL in production, PGlite for dev/test

- **Status**: Accepted
- **Date**: 2026-06-01
- **Deciders**: David Costa
- **Supersedes (in part)**: ADR 0001 (SQLite as the database engine)

## Context

ADR 0001 chose SQLite (via the synchronous `better-sqlite3` driver) to run a real
relational database in-process during early development. The app is now feature-complete
and production-bound, where it needs to handle concurrent users and larger datasets — the
case for PostgreSQL (FRD-006 #6).

The framing "just swap the Drizzle dialect" undersells one real cost: `better-sqlite3` is
**synchronous** (`.get()/.all()/.run()`) while every Postgres driver is **asynchronous**.
Migrating therefore means making the whole data layer — services and controllers — async.

We also wanted local dev and the test suite to stay zero-setup and fast, i.e. without
requiring developers (or CI unit jobs) to run a Postgres server.

## Options considered

1. **Postgres everywhere, real server for dev + tests** — most production-faithful, but
   every `pnpm dev` / `pnpm test` needs a running Postgres (or testcontainers). Heavier DX.
2. **Postgres in prod, keep SQLite for dev/test** — fast/simple locally, but dev and tests
   would run a *different* database engine than production (dialect drift risk).
3. **Postgres in prod, PGlite (embedded Postgres, WASM) for dev/test** — same engine
   everywhere, no server needed locally. Chosen.

## Decision

Use **PostgreSQL** as the database, with the driver selected at runtime in
`db/client.ts`:

- **Production / E2E** → real Postgres via `pg` (node-postgres) when `DATABASE_URL` is set.
- **Local dev** → embedded Postgres (**PGlite**, `@electric-sql/pglite`) persisted to
  `DATABASE_PATH` when `DATABASE_URL` is absent — no database server required.
- **Tests** → in-memory PGlite (`createTestDatabase`).

The whole data layer became `async/await`. Schema moved to `pgTable` with `boolean` and
`jsonb`; UUIDv7 **text** ids and ISO-8601 **text** timestamps were kept so list endpoints
keep using the id as a cursor and timestamp comparisons stay simple string comparisons.

## Consequences

- **Same engine in dev, test, and prod** — PGlite *is* Postgres, so dialect behaviour is
  consistent; tests still run in-process and need no server.
- **All services/controllers are async** — a one-time, mechanical but wide change.
- **Postgres aggregate gotchas** must be handled explicitly: `count()/sum()` are cast
  `::int` (bigint is returned as a string otherwise), and `date(text)` is replaced with
  `substr(reviewed_at, 1, 10)` for date grouping (timestamps are text).
- **No native build** in the backend image — `pg` is pure JS and PGlite is WASM, so the
  Docker image dropped the `python/make/g++` toolchain that `better-sqlite3` needed.
- **Config is validated** (`@nestjs/config` + Zod): production now requires `DATABASE_URL`
  and `JWT_SECRET`, enforced at startup.
