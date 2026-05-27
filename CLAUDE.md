# Magic Cards - Development Guidelines

## Project Overview
Magic Cards is a spaced repetition learning platform focused on programming and technology education, with a Duolingo-inspired UI. It uses an SM-2 algorithm for intelligent card scheduling.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Router + Query, react-i18next
- **Backend**: Fastify + tRPC + Drizzle ORM, SQLite
- **Validation**: Zod (shared between tRPC and Drizzle)
- **Monorepo**: pnpm workspaces
- **Dev Tools**: Biome, Husky, Vitest
- **Auth**: JWT-based with email/password (client-side logout)
- **Responsive**: Mobile-first, dark/light theme support

## Key Architecture Principles
1. **End-to-End Type Safety**: tRPC + Drizzle — types derived from schema, not manually defined
2. **Layered Backend**: Routers (presentation) → Services (business logic) → Drizzle (data)
3. **Services Only When Needed**: Simple CRUD goes router → Drizzle directly. Services exist for SM-2, auth, learning session logic
4. **TypeScript Strict Mode**: Full type safety, no implicit any
5. **Server State via TanStack Query**: No manual fetch hooks or API cache contexts
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
│   ├── backend/                  # Fastify + tRPC + Drizzle
│   │   └── src/
│   │       ├── db/               # Drizzle schema, client, migrations
│   │       ├── routers/          # tRPC routers (auth, subjects, cards, learning)
│   │       ├── services/         # Business logic (auth, sm2, learning)
│   │       ├── middleware/       # JWT validation → protectedProcedure
│   │       ├── trpc.ts           # tRPC init + procedure builders
│   │       ├── context.ts        # tRPC context creation
│   │       └── server.ts         # Fastify boot
│   └── frontend/                 # React + Vite
│       └── src/
│           ├── components/       # common/ + features/ + ui/
│           ├── pages/
│           ├── context/          # AuthContext, ThemeContext
│           ├── utils/            # cn.ts, trpc.ts (client setup)
│           └── i18n/             # en.json, pt.json
```

## Development Workflow

### Dev Servers
Two servers run in parallel:
1. **Frontend** (Vite): `localhost:5173`
2. **Backend** (Fastify + tRPC): `localhost:3001`

### Common Commands
```bash
pnpm dev                          # Start all dev servers
pnpm test                         # Run all tests
pnpm lint                         # Biome check all
pnpm type:check                   # TypeScript check all
pnpm --filter backend db:migrate  # Run Drizzle migrations
pnpm --filter backend db:generate # Generate migration from schema
```

### Code Quality
- **Linter/Formatter**: Biome (no Prettier/ESLint)
- **Git Hooks**: Husky pre-commit (lint + type check) and pre-push (tests)
- **Testing**: Vitest for both frontend and backend — 80%+ coverage target
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
1. **Phase 0**: Foundation (monorepo, Fastify+tRPC+Drizzle, auth, frontend scaffold)
2. **Phase 1**: Core learning (subjects, cards, SM-2, learning sessions)
3. **Phase 2**: Frontend polish (Markdown rendering, animations, theme, i18n)
4. **Phase 3**: Dashboard & analytics (stats, streaks, weak cards)
5. **Phase 4**: Production ready (PostgreSQL migration, deployment, security audit)

## Important Files to Know
- `docs/architecture.md` — Complete system design (schema, procedures, algorithms)
- `docs/adr/` — Architecture Decision Records
- `CONTEXT.md` — Domain glossary (canonical terms and rules)
- `packages/backend/src/db/schema.ts` — Drizzle schema (source of truth for DB types)
- `packages/backend/src/routers/index.ts` — appRouter (all tRPC procedures)
- `packages/frontend/src/utils/trpc.ts` — tRPC client + React Query setup

## API Design
- **Protocol**: tRPC over HTTP (Fastify adapter) — not REST
- **Auth**: JWT in `Authorization: Bearer <token>` header, validated in tRPC context middleware
- **Procedures**: `publicProcedure` (auth) and `protectedProcedure` (everything else)
- **Validation**: Zod schemas on every procedure input

## Database
- **Current**: SQLite (in-process via better-sqlite3)
- **Future**: PostgreSQL (Drizzle dialect swap)
- **Key Entities**: User, Subject, Card, CardProgress, ReviewHistory

## Notes for Future Sessions
- `docs/architecture.md` and `CONTEXT.md` are the sources of truth
- i18n lives exclusively in the frontend — backend returns error codes only
- Hints cap quality at 3 in the SM-2 algorithm
- Card difficulty is emergent (ease factor), not a static field
- Subject card count is computed on demand, never stored
- Mobile-first responsive design is non-negotiable
- Dark mode should be implemented early (ThemeContext + Tailwind)

## Commit Convention
- Do NOT use `Co-Authored-By` in commit messages
