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

## Addendum (2026-06-05): local dev moved to a real Postgres server

Option 1 ("real server for dev") was reconsidered for **local dev only**, and adopted.

**Why.** PGlite persists to disk only on a clean async `client.close()`. Under `nest start --watch`,
restarts and non-graceful kills don't reliably let that flush finish, and the dev lock is advisory
only (`db/client.ts`), so two processes can briefly touch the same dir. The result was **recurring
corruption** of `data/pg` (`new PGlite('./data/pg')` aborting with WASM `Aborted()` before any SQL;
multiple `data/pg.corrupt-*` backups accumulated). A real Postgres runs as a **separate server**, so
backend restarts / kills / hot-reloads can't corrupt it — this eliminates the entire failure class.

**What changed.** Dev now sets `DATABASE_URL` (a local Postgres; here a dedicated `magic_cards`
database on an already-running server, no Docker needed). No application code changed — `db/client.ts`
already selects `pg` when `DATABASE_URL` is set, and `migrate.mjs` already migrates a URL transactionally
via node-postgres. PGlite is **retained** as the fallback when `DATABASE_URL` is unset and remains the
engine for the in-memory test suite (so `@electric-sql/pglite` stays a dependency). `db:migrate:dev` /
`db:repair` are now PGlite-only / legacy helpers.

**Trade-off accepted.** Local dev no longer is strictly zero-setup — it needs a reachable Postgres —
but in exchange the dev database stops corrupting. Tests and CI unit jobs are unaffected (still
in-memory PGlite). The original decision (PGlite for dev) stands only as the documented fallback.
