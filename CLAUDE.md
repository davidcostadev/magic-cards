# Magic Cards - Development Guidelines

## Project Overview
Magic Cards is a spaced repetition learning platform focused on programming and technology education, with a Duolingo-inspired UI. It uses an SM-2 algorithm for intelligent card scheduling.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Router + Query, react-i18next
- **Backend**: NestJS (Fastify adapter) + REST API (`/v1`, Stripe-style) + Drizzle ORM, SQLite
- **API Contract**: OpenAPI 3.1 (generated from Zod via `@nestjs/swagger` + `nestjs-zod`); frontend uses a generated `openapi-fetch` client
- **Validation**: Zod (single source of truth — request validation, OpenAPI spec, aligned with Drizzle)
- **Monorepo**: pnpm workspaces
- **Dev Tools**: Biome, Husky, Vitest
- **Auth**: JWT-based with email/password (client-side logout)
- **Responsive**: Mobile-first, dark/light theme support

## Key Architecture Principles
1. **End-to-End Type Safety**: Drizzle (DB) + Zod → OpenAPI 3.1 → generated TS client — types derived from schema, not manually defined (codegen via `pnpm gen:api`; spec committed, CI drift check)
2. **Layered Backend**: Controllers (presentation) → Services (business logic) → Drizzle (data), as NestJS modules
3. **Services Only When Needed**: Simple CRUD goes controller → Drizzle directly. Services (Nest providers) exist for SM-2, auth, learning session logic
4. **TypeScript Strict Mode**: Full type safety, no implicit any
5. **Server State via TanStack Query**: Over a typed REST client (`openapi-fetch`); no manual fetch hooks or API cache contexts
6. **Client State via Context**: AuthContext + ThemeContext only

## Project Structure
```
magic-cards/
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── CLAUDE.md
├── CONTEXT.md                    # Domain glossary
├── docs/
│   ├── architecture.md           # Full system design
│   └── adr/                      # Architecture Decision Records
├── packages/
│   ├── backend/                  # NestJS (Fastify adapter) + REST (/v1) + Drizzle
│   │   └── src/
│   │       ├── main.ts           # Nest bootstrap (Fastify adapter), swagger, global /v1 prefix
│   │       ├── app.module.ts     # root module
│   │       ├── db/               # Drizzle schema, client, migrations
│   │       ├── modules/          # feature module per resource (auth, subjects, cards, reviews, dashboard, learning)
│   │       │                     #   each: *.controller.ts, *.service.ts, dto/*.dto.ts (createZodDto)
│   │       └── common/           # JwtAuthGuard, HttpExceptionFilter (error envelope), list interceptor, pagination
│   └── frontend/                 # React + Vite
│       └── src/
│           ├── components/       # common/ + features/ + ui/
│           ├── pages/
│           ├── context/          # AuthContext, ThemeContext
│           ├── api/              # client.ts (openapi-fetch), schema.d.ts (generated), queries/
│           ├── utils/            # cn.ts
│           └── i18n/             # en.json, pt.json
```

## Development Workflow

### Dev Servers
Two servers run in parallel:
1. **Frontend** (Vite): `localhost:5173`
2. **Backend** (NestJS on Fastify + REST `/v1`): `localhost:3001` (Swagger docs at `/docs`)

### Common Commands
```bash
pnpm dev                          # Start all dev servers
pnpm test                         # Unit/integration (Vitest) — add --watch for the TDD loop
pnpm test:e2e                     # Playwright full-stack E2E against the Docker stack
pnpm gen:api                      # Regenerate openapi.json + frontend client types
pnpm lint                         # Biome check all
pnpm type:check                   # TypeScript check all
pnpm --filter backend db:migrate  # Run Drizzle migrations
pnpm --filter backend db:generate # Generate migration from schema
```

### Code Quality
- **Linter/Formatter**: Biome (no Prettier/ESLint)
- **Git Hooks**: Husky pre-commit (lint + type check) and pre-push (tests)
- **TDD**: build features test-first (ADR 0005) — failing test → implement → refactor. Applies to backend services/endpoints and frontend logic/components (not pure visual/polish)
- **Testing**: Vitest (unit/integration, both packages) + RTL (components) + `@nestjs/testing`/supertest (API) + **Playwright** for full-stack E2E in Docker — 80%+ coverage target on services/critical logic
- **Naming**: PascalCase components, camelCase functions, UPPER_SNAKE_CASE constants

### Commit Convention
```
feat: add new feature
fix: fix a bug
docs: documentation changes
refactor: code restructuring (no behavior change)
test: test additions/modifications
chore: tooling, dependencies
```

## Implementation Phases (Reference)
See `docs/architecture.md` section 13 for detailed phases:
1. **Phase 0**: Foundation (monorepo, NestJS-on-Fastify+REST+Drizzle, OpenAPI, auth, frontend scaffold)
2. **Phase 1**: Core learning (subjects, cards, SM-2, learning sessions)
3. **Phase 2**: Frontend polish (Markdown rendering, animations, theme, i18n)
4. **Phase 3**: Dashboard & analytics (stats, streaks, weak cards)
5. **Phase 4**: Production ready (PostgreSQL migration, deployment, security audit)

## Important Files to Know
- `docs/architecture.md` — Complete system design (schema, REST endpoints, algorithms)
- `docs/adr/` — Architecture Decision Records (0003 = REST/Stripe/OpenAPI; 0004 = NestJS-on-Fastify + nestjs-zod + Drizzle; 0005 = TDD + Playwright E2E in Docker; 0003/0004 supersede/refine 0002)
- `CONTEXT.md` — Domain glossary (canonical terms and rules)
- `packages/backend/src/db/schema.ts` — Drizzle schema (source of truth for DB types; UUIDv7 IDs)
- `packages/backend/src/app.module.ts` — root Nest module; feature modules under `src/modules/`
- `packages/frontend/src/api/client.ts` — typed `openapi-fetch` client (+ `schema.d.ts` generated)

## API Design
- **Protocol**: REST over HTTP, versioned under `/v1` (plain path prefix), modeled on Stripe (pragmatic profile)
- **Auth**: JWT in `Authorization: Bearer <token>` header, validated by a Nest `JwtAuthGuard`
- **Verbs**: `GET` (retrieve/list), `POST` (create), `PATCH` (partial update), `PUT` (replace), `DELETE`
- **Envelopes**: Stripe list envelope `{ object: "list", data, has_more, url }`; error envelope `{ error: { type, code, param } }` where `code` is the i18n key (types: invalid_request_error/authentication_error/api_error — no 403)
- **Pagination**: cursor-based (`limit`, `starting_after`, `ending_before`) over UUIDv7 IDs. No `expand[]`, no idempotency keys (double-submit guarded client-side)
- **Validation**: Zod via `nestjs-zod` on every endpoint (params/query/body), shared with the OpenAPI spec
- **Contract**: OpenAPI 3.1 (`@nestjs/swagger`); swagger UI at `/docs`; committed spec + CI drift check

## Database
- **Current**: SQLite (in-process via better-sqlite3)
- **Future**: PostgreSQL (Drizzle dialect swap)
- **Key Entities**: User, Subject, Card, CardProgress, ReviewHistory

## Notes for Future Sessions
- `docs/architecture.md` and `CONTEXT.md` are the sources of truth
- Build features test-first (TDD) — write the failing Vitest test before the implementation; full-stack flows are covered by Playwright E2E in Docker (ADR 0005)
- i18n lives exclusively in the frontend — backend returns error codes only
- Hints cap quality at 3 in the SM-2 algorithm
- Card difficulty is emergent (ease factor), not a static field
- Subject card count is computed on demand, never stored
- Mobile-first responsive design is non-negotiable
- Dark mode should be implemented early (ThemeContext + Tailwind)

## Commit Convention
- Do NOT use `Co-Authored-By` in commit messages
