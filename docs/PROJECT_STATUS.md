# Project Status — Magic Cards

> Living context snapshot. Updated **2026-06-01** (branch `main`). For the canonical design see
> [`architecture.md`](./architecture.md), the domain glossary [`../CONTEXT.md`](../CONTEXT.md), and
> the [ADRs](./adr/). This file tracks *what is built* and *what is left*, so a new session can get
> oriented fast.

## 1. What it is

Spaced-repetition learning platform for programming/tech, Duolingo-inspired UI, SM-2 scheduling.
Monorepo (pnpm): **`packages/backend`** (NestJS on Fastify + REST `/v1` + Drizzle) and
**`packages/frontend`** (React + Vite + TanStack). End-to-end type safety: Drizzle + Zod → OpenAPI
3.1 → generated `openapi-fetch` client.

## 2. Implementation status by phase

Legend: ✅ done · 🟡 partial · ⬜ not started · ⏸️ deliberately deferred.
(Note: the checkboxes in `architecture.md §13` were the original plan and were never ticked; this
table is the accurate state.)

| Phase | Scope | Status |
|---|---|---|
| **0 — Foundation** | Monorepo, NestJS+Fastify+REST+Drizzle, Zod+swagger+`openapi.json`+CI drift check, schema+migrations (UUIDv7), auth (signup/login/JWT), `JwtAuthGuard`+exception filter+list interceptor, frontend scaffold+`openapi-fetch`, AuthContext+login/signup, test harness (Vitest+supertest+RTL+Playwright) | ✅ |
| **1 — Core Learning** | Subject CRUD, Card CRUD, SM-2 service, learning session, review-history logging, session UI | ✅ |
| **2 — Frontend Polish** | Markdown + syntax highlighting, review animations, dark/light theme, mobile-first responsive, i18n (en/pt) | ✅ |
| **3 — Dashboard & Analytics** | Stats, streaks, accuracy (7d/30d), status breakdown, weak cards, upcoming-reviews forecast, daily-goal bar | ✅ |
| **4 — Production Ready** | PostgreSQL migration (pg + PGlite), security audit, Dockerfiles (backend+frontend), CI (lint→type→unit→E2E), coverage gates, hardened Playwright E2E | ✅ except deployment wiring (see gaps) |
| **+ Shared Content Catalog** | `isPublic` subjects owned by a system user; `x-api-key` publish + delete endpoints; idempotent seed; read/write authorization split (`canSeeSubject`/`ownsSubject`) | ✅ (ADR 0007) |

### Backend modules (`packages/backend/src/modules/`)
`auth` · `subjects` · `cards` · `learning` (SM-2 + sessions) · `reviews` · `dashboard` · `catalog`

### Frontend pages (`packages/frontend/src/pages/`)
`Login` · `Signup` · `Onboarding` · `Subjects` · `SubjectDetail` · `LearningSession` · `Dashboard` ·
`Settings` · `NotFound`

## 3. "Are all features implemented?" — short answer

**Yes for the planned product** (Phases 0–3 are feature-complete, Phase 4 done except a deploy
target), **plus** the shared-content catalog. Remaining items are operational/optional, not core
product gaps — see below.

## 4. Known gaps & deferred work

| Item | State | Notes |
|---|---|---|
| **Deployment target** | ⬜ | Dockerfiles + `docker-compose.e2e.yml` exist; no host wiring (fly.toml/railway, secrets, domain). |
| **Alternative card types** (quiz / match / type-answer) | ⏸️ | Backend supports **open** cards only by design for now; prototypes deferred. |
| **Rate limiter → Redis** | ⬜ | Currently in-memory (`@nestjs/throttler`) — fine for one instance; Redis store needed for multi-instance/horizontal scaling. |
| **Route code-splitting** | 🟡 | DB indexes present; frontend code-splitting not audited. |

## 5. Shared content catalog (quick reference)

Trusted operator publishes public content visible (read-only) to every learner. Authorized by the
server secret **`CONTENT_API_KEY`** via the `x-api-key` header — **not** a user login. Full guide:
[`content-catalog.md`](./content-catalog.md), design: [ADR 0007](./adr/0007-shared-content-catalog-via-api-key.md).

- `POST /v1/catalog/subjects` · `POST /v1/catalog/cards` · `DELETE /v1/catalog/subjects/:id`
- Idempotent seed: `pnpm --filter backend seed:catalog` (example Git + HTTP content).
- The key is **catalog-only** (public, system-owned content); it can never touch a user's deck.

## 6. Database

PostgreSQL everywhere (async data layer). Real **`pg`** in prod/E2E when `DATABASE_URL` is set;
embedded **PGlite** (in-process WASM Postgres) for zero-setup dev (file at `DATABASE_PATH`) and tests
(in-memory). Driver chosen at runtime. Schema is Drizzle `pgTable`, UUIDv7 text ids, ISO-text
timestamps, `jsonb` hints/tags. Cascade FKs from subjects → cards → progress/history. See ADR 0006.

> Postgres gotchas (already handled): `count()/sum()` cast `::int` (bigint comes back as string);
> `cardCount` uses LEFT JOIN + GROUP BY, **not** a correlated subquery (drizzle's single-table
> `.select()` renders subquery columns unqualified → `id` would bind to `cards.id`). Fixed 2026-06-01.

## 7. Run / test / seed

```bash
pnpm dev                          # frontend :5173 + backend :3001 (Swagger at /docs)
pnpm test                         # Vitest — in-memory PGlite, never touches the dev DB
pnpm test:e2e                     # Playwright full-stack E2E (Docker postgres+backend+frontend)
pnpm gen:api                      # regenerate openapi.json + frontend client types (CI drift-checked)
pnpm lint  /  pnpm type:check
pnpm --filter backend seed:catalog   # idempotent example public content (stop dev backend first on PGlite)
```

Tests use a disposable in-memory Postgres per run — **running tests never dirties the dev DB and
needs no cleanup**.

## 8. Recent notable changes (2026-06-01)

- **Shared content catalog** added (publish/delete/seed + `x-api-key` guard, ADR 0007).
- **Bug fix:** subject `cardCount` was always 0 (correlated-subquery column-qualification trap) →
  LEFT JOIN + GROUP BY, with a regression test.
- **Config:** deterministic test config (ignore `.env` under test); Vitest 4 cleanup
  (`maxWorkers`, `oxc:false`).

## 9. Sources of truth

`architecture.md` (full design) · `CONTEXT.md` (domain glossary) · `adr/` (decisions) ·
`content-catalog.md` (catalog usage) · `security-audit.md` (security posture) ·
`packages/backend/src/db/schema.ts` (DB types).
