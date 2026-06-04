# Handoff — Execute the dev DB migration: PGlite → Postgres

**Date:** 2026-06-04
**Branch:** `main` — unpushed: `f49cf69` (report feature), `662e3e6` (migration plan), `e8fcbef` (this
handoff); the user also committed `ede9c44` (eliminate-choice). **Nothing pushed.** Working tree is
clean apart from a local, untracked `.claude/` (`settings.local.json` + a lock — leave it untracked).

**Next session's focus (per the user):** carry out the plan in
[`docs/dev-postgres-migration.md`](../../docs/dev-postgres-migration.md) — replace the embedded PGlite
dev database with a real Postgres (Docker) for local development. That doc is the source of truth for
steps, verification, and rollback; this handoff is orientation + state, not a re-description of it.

## Why this is happening (motivation, in one paragraph)

The PGlite dev DB (`packages/backend/data/pg`) **corrupts repeatedly** — there are multiple
`data/pg.corrupt-*` backups, and it corrupted again this session. Root cause (confirmed by reading the
code, **not** a Drizzle or migration bug): PGlite is in-process WASM Postgres that only persists on a
clean async `client.close()`; `nest start --watch` restarts and non-graceful kills don't reliably let
that finish, and the dev lock is advisory only (`packages/backend/src/db/client.ts:27-33`), so two
processes can briefly touch the same dir. Real Postgres runs as a separate server → app
restarts/kills can't corrupt it. The code **already** supports `pg` when `DATABASE_URL` is set
(`client.ts:73-78`; `migrate.mjs:98-100`), so the change is mostly infra/config.

## ⚠️ Current state you must know before starting

1. **The dev PGlite DB is corrupt and unrecoverable.** `new PGlite('./data/pg')` aborts with WASM
   `Aborted()`; `pnpm --filter backend db:repair` fails the same way (it must open the dir to read it).
   Local dev data (account/subjects/cards) is gone. This is fine for the migration — once on Postgres,
   `data/pg` is irrelevant; just leave the `pg.corrupt-*` dirs as-is or delete them after Postgres works.
2. **The dev server was stopped** this session (I killed the `pnpm dev` tree to attempt a migration).
   It is **not running**. Nothing holds `data/pg` now.
3. **Eliminate-choice is now committed** (`ede9c44`, by the user) with the contract regenerated —
   `openapi.json`/`schema.d.ts` already include `eliminate`, so there is **no drift**. Nothing is
   pending there; the working tree is clean (only the local `.claude/` dir is untracked — don't commit it).

## What shipped this session (already committed — don't redo)

- `f49cf69` `feat(learning): report cards as wrong or improvable + filter reported cards` — the full
  card-report feature (backend `reports` module + migration `0006`, frontend bottom-sheet/modal,
  `Sheet`/`useModalA11y`, "Reported" filter, en/pt i18n, regenerated contract). Read `git show --stat f49cf69`.
- `662e3e6` `docs: plan to migrate the dev database from PGlite to Postgres` — the plan to execute next.
- Verified before commit: `pnpm type:check`, `pnpm lint` clean; backend + frontend test suites green
  (the report feature added `reports.controller.spec.ts` (9) and `ReportCardSheet.test.tsx` (3)).
- The original plan-mode plan for the report feature: `~/.claude/plans/wiggly-churning-ocean.md`.

## How to execute the migration (decisions to make first)

The plan's "Decisões em aberto" must be settled with the user before touching files:
- **Port** 5432 vs 5433 (collision with a system Postgres?).
- **Persistence**: named volume (recommended) vs ephemeral.
- **`predev`** auto-`docker compose up` vs manual `pnpm db:up`.
- **Seed**: recreate dev data by hand vs a seed/`catalog/import` script.

Then follow `docs/dev-postgres-migration.md` §1–§7. Quick orientation on the moving parts:
- New `docker-compose.dev.yml` (postgres:17-alpine; mirror `docker-compose.e2e.yml`’s service).
- Set `DATABASE_URL` in `packages/backend/.env` (note: `.env` is **read-blocked** for the agent by
  permission settings — you may need the user to edit it, or use `! <cmd>` from them; `.env.example` is
  readable and should get the comment update).
- Migrate real PG via `pnpm --filter backend db:migrate` (`drizzle-kit migrate`) — distinct from the
  PGlite-only `db:migrate:dev`/`db:repair`, which become legacy/fallback.
- **Tests don't change**: they use in-memory PGlite (`createTestDatabase`) — keep the `@electric-sql/pglite` dep.
- Update `CLAUDE.md`, `docs/PROJECT_STATUS.md §6`, and add an addendum to **ADR 0006** (dev now uses Postgres).

## Gotchas / environment

- **Heavy-op lock:** a `~/.claude` hook serializes docker/e2e/integration to one at a time (see memory
  `global-heavy-op-lock`). `docker compose up` for the dev Postgres will go through it — if it seems to
  hang, check the lock status via `heavy_op_lock.py`.
- **WSL2** host: `localhost:5432` works; confirm Docker is available (`docker info`) before relying on the plan.
- Nothing is pushed; the user commits to `main` directly (solo workflow). Commit only when asked.

## Suggested skills

- **`database-migration`** — for the schema/data move and zero-downtime/rollback framing (here it's a
  local dev engine swap, but the patterns and verification mindset apply).
- **`run`** (or **`verify`**) — after wiring Postgres, launch the app to confirm signup → create
  subject/cards → study → **report a card** → "Reported" filter all work against the new DB.
- **`update-config`** — if any of the migration needs settings.json/permission/env-var changes
  (e.g. allowing `docker`/`pnpm db:*` commands without prompts).
