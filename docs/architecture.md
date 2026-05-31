# Magic Cards - Architecture Documentation

## 1. Project Overview

Magic Cards is a spaced repetition learning platform designed primarily for programming and technology, but applicable to any subject matter. Inspired by Anki and Memorize, it combines intelligent card scheduling with an engaging, Duolingo-like interface to optimize retention and learning outcomes.

### Core Features
- **Subject-based Organization**: Organize learning materials into subjects, each containing multiple cards
- **Spaced Repetition Algorithm**: SM-2 algorithm determines when cards reappear based on user performance
- **Markdown Content**: Questions and answers support full Markdown with syntax-highlighted code blocks
- **Hints System**: Optional per-card hints that aid recall but penalize scheduling (quality capped at 3)
- **Multi-language Support**: i18n for English and Portuguese (frontend-only, backend returns error codes)
- **Learning Metrics**: Dashboard with accuracy, streaks, weak cards, and review forecasts
- **Dark/Light Theme**: Full theme support with seamless toggling
- **Mobile-First Responsive Design**: Works seamlessly on mobile and desktop
- **User Authentication**: Email/password signup with JWT-based session management

---

## 2. Technology Stack

### Frontend
- **Build Tool**: Vite
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Class Merge**: `cn()` utility from clsx/tailwind-merge
- **Routing**: TanStack Router (type-safe, integrated with TanStack Query)
- **Server State**: TanStack Query over a typed REST client (`openapi-fetch`, generated from the OpenAPI spec)
- **Client State**: React Context (AuthContext, ThemeContext)
- **Markdown Rendering**: react-markdown with syntax highlighting (e.g., rehype-highlight or shiki)
- **Testing**: Vitest + React Testing Library
- **Code Quality**: Biome (linter + formatter)
- **i18n**: react-i18next

### Backend
- **Framework**: NestJS on the **Fastify adapter** (`@nestjs/platform-fastify`) — Nest's structure, Fastify's performance (see ADR 0004)
- **API Layer**: REST under `/v1`, modeled on Stripe (pragmatic profile — see §6)
- **API Schema**: Zod request/response schemas via `nestjs-zod` (`ZodValidationPipe` + `createZodDto`)
- **API Docs/Contract**: OpenAPI 3.1 emitted by `@nestjs/swagger` (patched via `patchNestjsSwagger`; Swagger UI at `/docs`)
- **Database**: SQLite (in-process via better-sqlite3)
- **ORM**: Drizzle ORM
- **Validation**: Zod (single source of truth — drives both request validation and the OpenAPI spec)
- **Testing**: Vitest (+ `@nestjs/testing` + supertest for endpoint/E2E tests)
- **Code Quality**: Biome (linter + formatter)
- **Authentication**: JWT (jose or jsonwebtoken) + bcrypt, via a Nest `JwtAuthGuard`
- **Environment**: Node.js 18+

### Monorepo
- **Package Manager**: pnpm workspaces
- **Structure**: `packages/frontend` + `packages/backend`
- **Type Sharing**: The backend emits an OpenAPI 3.1 spec from its Zod schemas; `pnpm gen:api` boots Nest standalone (no `listen`), writes the committed `openapi.json`, and generates `api/schema.d.ts` for the frontend's typed client. End-to-end type safety via codegen instead of a direct `AppRouter` import. CI re-runs `gen:api` and fails if the committed spec drifts.

### Development
- **Dev Servers**: Two processes (frontend on :5173, backend on :3001)
- **Git Hooks**: Husky + lint-staged
  - Pre-commit: Biome lint/format + TypeScript check
  - Pre-push: Full test suite + type checking
- **Version Control**: Git with conventional commits

---

## 3. Project Structure

```
magic-cards/
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── CLAUDE.md
├── CONTEXT.md                    # Domain glossary
├── docs/
│   ├── architecture.md           # This file
│   └── adr/                      # Architecture Decision Records
├── packages/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── .env.example
│   │   └── src/
│   │       ├── main.ts                   # Nest bootstrap (Fastify adapter), swagger, global prefix /v1
│   │       ├── app.module.ts             # root module (imports feature modules + common providers)
│   │       ├── db/
│   │       │   ├── schema.ts             # Drizzle table definitions
│   │       │   ├── client.ts             # SQLite connection
│   │       │   └── migrations/           # Drizzle Kit migrations
│   │       ├── modules/                  # one feature module per resource (controller + service + dto)
│   │       │   ├── auth/                 # POST /v1/auth/signup, /login; GET+PATCH /v1/me
│   │       │   ├── subjects/             # /v1/subjects CRUD + /:id/stats
│   │       │   ├── cards/                # /v1/cards CRUD (filtered by ?subject=)
│   │       │   ├── reviews/              # /v1/review_queue(/next), POST /v1/reviews
│   │       │   ├── dashboard/            # /v1/dashboard/stats|weak_cards|upcoming
│   │       │   └── learning/             # sm2.service + learning.service (providers)
│   │       │   #  each module: *.controller.ts, *.service.ts, dto/*.dto.ts (createZodDto)
│   │       ├── common/
│   │       │   ├── guards/jwt-auth.guard.ts        # validates JWT → request.user
│   │       │   ├── filters/http-exception.filter.ts # → Stripe error envelope { error: {...} }
│   │       │   ├── interceptors/list.interceptor.ts # → { object:"list", data, has_more, url }
│   │       │   └── pagination.ts                    # UUIDv7 cursor helpers
│   │       └── (Zod schemas live in each module's dto/, shared schemas in common/)
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       ├── biome.json
│       ├── index.html
│       └── src/
│           ├── components/
│           │   ├── common/
│           │   │   ├── Header.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   ├── ThemeToggle.tsx
│           │   │   └── LanguageSelector.tsx
│           │   ├── features/
│           │   │   ├── auth/
│           │   │   │   ├── LoginForm.tsx
│           │   │   │   ├── SignupForm.tsx
│           │   │   │   └── AuthLayout.tsx
│           │   │   ├── learning/
│           │   │   │   ├── CardReview.tsx
│           │   │   │   ├── HintReveal.tsx
│           │   │   │   ├── AnswerReveal.tsx
│           │   │   │   ├── QualityButtons.tsx
│           │   │   │   └── SessionSummary.tsx
│           │   │   ├── subjects/
│           │   │   │   ├── SubjectList.tsx
│           │   │   │   ├── SubjectCard.tsx
│           │   │   │   ├── CreateSubjectModal.tsx
│           │   │   │   └── SubjectDetail.tsx
│           │   │   ├── dashboard/
│           │   │   │   ├── Dashboard.tsx
│           │   │   │   ├── StatsCard.tsx
│           │   │   │   ├── StreakWidget.tsx
│           │   │   │   ├── WeakCardsWidget.tsx
│           │   │   │   └── UpcomingReviews.tsx
│           │   │   └── cards/
│           │   │       ├── CardList.tsx
│           │   │       ├── CardForm.tsx
│           │   │       └── CardEditModal.tsx
│           │   └── ui/
│           │       └── (shadcn/ui components)
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── SignupPage.tsx
│           │   ├── DashboardPage.tsx
│           │   ├── SubjectsPage.tsx
│           │   ├── LearningSessionPage.tsx
│           │   ├── SettingsPage.tsx
│           │   └── NotFoundPage.tsx
│           ├── context/
│           │   ├── AuthContext.tsx
│           │   └── ThemeContext.tsx
│           ├── api/
│           │   ├── client.ts         # openapi-fetch client + auth header injection
│           │   ├── schema.d.ts        # generated from /openapi.json (pnpm gen:api)
│           │   └── queries/           # TanStack Query hooks per resource
│           ├── utils/
│           │   ├── cn.ts
│           │   └── formatters.ts
│           ├── i18n/
│           │   ├── en.json
│           │   ├── pt.json
│           │   └── config.ts
│           ├── styles/
│           │   └── globals.css
│           ├── App.tsx
│           └── main.tsx
```

---

## 4. Database Design (Drizzle + SQLite)

### Schema

Drizzle generates TypeScript types from the schema — no manual type definitions needed.

All `id` columns are **UUIDv7** (time-sortable) — generated by the app on insert. Because they sort by
creation time, list endpoints use the `id` directly as a pagination cursor (`starting_after` /
`ending_before`) without a separate sort key (see §6).

#### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | text (UUID) | PK |
| email | text | unique, not null |
| passwordHash | text | not null |
| username | text | not null |
| language | text | default: 'en' |
| theme | text | default: 'light' |
| dailyGoal | integer | default: 20 |
| createdAt | text (ISO) | not null |
| updatedAt | text (ISO) | not null |

#### subjects
| Column | Type | Constraints |
|--------|------|-------------|
| id | text (UUID) | PK |
| userId | text | FK → users.id, not null |
| title | text | not null |
| description | text | |
| color | text | hex color |
| icon | text | |
| createdAt | text (ISO) | not null |
| updatedAt | text (ISO) | not null |

Card count is always computed on demand — never stored.

#### cards
| Column | Type | Constraints |
|--------|------|-------------|
| id | text (UUID) | PK |
| subjectId | text | FK → subjects.id, not null |
| question | text | Markdown, not null |
| answer | text | Markdown, not null |
| hints | text | JSON array of strings |
| tags | text | JSON array of strings |
| createdAt | text (ISO) | not null |
| updatedAt | text (ISO) | not null |

No static difficulty field. Difficulty is emergent via the SM-2 ease factor.

#### cardProgress
| Column | Type | Constraints |
|--------|------|-------------|
| id | text (UUID) | PK |
| userId | text | FK → users.id, not null |
| cardId | text | FK → cards.id, not null |
| interval | integer | days, default: 1 |
| easeFactor | real | 1.3–2.5, default: 2.5 |
| repetitions | integer | default: 0 |
| nextReviewDate | text (ISO) | not null |
| lastReviewDate | text (ISO) | |
| status | text | 'new' / 'learning' / 'reviewing' / 'mastered' |
| createdAt | text (ISO) | not null |
| updatedAt | text (ISO) | not null |

Unique constraint on (userId, cardId).

#### reviewHistory
| Column | Type | Constraints |
|--------|------|-------------|
| id | text (UUID) | PK |
| userId | text | FK → users.id, not null |
| cardId | text | FK → cards.id, not null |
| subjectId | text | FK → subjects.id, not null |
| quality | integer | 1–5 |
| reviewedAt | text (ISO) | not null |
| timeSpent | integer | milliseconds |
| wasHintUsed | integer | 0 or 1 (SQLite boolean) |

Immutable — insert only, never updated.

---

## 5. Backend Architecture (NestJS + REST + OpenAPI)

NestJS runs on the Fastify adapter. Cross-cutting Stripe concerns are global Nest providers, so controllers
stay thin: a **`JwtAuthGuard`** (auth), an **`HttpExceptionFilter`** (error envelope), and a **list
interceptor** (list envelope). Validation + OpenAPI come from `nestjs-zod`.

### Layers

#### Controllers (Presentation)
- One Nest controller per resource, routes mounted under the global `/v1` prefix
- Validate request (params, query, body) via `nestjs-zod`'s `ZodValidationPipe` and `createZodDto` — the
  same Zod schemas feed the OpenAPI spec via `patchNestjsSwagger`
- Delegate to services (when business logic exists) or query Drizzle directly (for simple CRUD)
- No business logic in controllers
- List responses are wrapped by the global list interceptor; errors by the global exception filter (see §6)

#### Services (Business Logic)
- Injectable Nest **providers**, but the logic stays framework-agnostic (no controller/HTTP imports)
- Only created when real logic exists:
  - `auth.service.ts` — password hashing, JWT sign/verify
  - `sm2.service.ts` — spaced repetition algorithm
  - `learning.service.ts` — session card selection, stats computation
- Simple CRUD does not warrant a service — the controller calls Drizzle directly

#### Database (Infrastructure)
- Drizzle schema + SQLite client
- No repository layer — Drizzle is the abstraction
- Migration from SQLite to PostgreSQL requires changing the Drizzle dialect, not rewriting queries

### Authentication Flow
- **Public routes** — accessible without auth: `POST /v1/auth/signup`, `POST /v1/auth/login`
- **Protected routes** — everything else; require a valid JWT in the `Authorization: Bearer <token>` header
- A global **`JwtAuthGuard`** validates the token and sets `request.user`; public routes opt out with an
  `@Public()` decorator. Missing/invalid tokens return `401 authentication_error`
- Logout is 100% client-side (remove token from localStorage)

---

## 6. REST API (`/v1`, Stripe-style)

The API is RESTful and versioned under `/v1`, modeled on Stripe's conventions in a **pragmatic profile**:
Stripe's resource layout, list envelope, error envelope, and cursor pagination, but with conventional REST
verbs, JSON request bodies, `camelCase` fields, ISO 8601 timestamps, and plain UUIDv7 IDs. `/v1` is a plain
path prefix (an escape hatch), not a version-negotiation system.

### Cross-cutting Conventions

- **Base path**: every endpoint lives under `/v1`.
- **Auth**: `Authorization: Bearer <JWT>` on protected endpoints. Public: signup, login.
- **Request bodies**: JSON (`application/json`).
- **Verbs**: `GET` (retrieve/list), `POST` (create), `PATCH` (partial update), `PUT` (replace),
  `DELETE` (remove).
- **Single resource response**: the bare resource object in `camelCase` with ISO timestamps
  (`createdAt`, `updatedAt`). No `object` field, no prefixed IDs.
- **Single resource response**: bare object in `camelCase` with ISO timestamps. No per-resource `object`
  field — the generated TS types are the discriminator.
- **List response (Stripe envelope)**:
  ```json
  { "object": "list", "url": "/v1/cards", "has_more": false, "data": [ /* resources */ ] }
  ```
  Cursor pagination via query params `limit` (default 20, max 100), `starting_after`, `ending_before`.
  Cursors are resource `id`s; since IDs are **UUIDv7** (time-sortable), they double as the sort key — no
  separate cursor column needed.
- **No `expand[]`**: a single first-party frontend joins related data from the TanStack Query cache, so
  resources carry only foreign-key IDs (e.g. `subjectId`). Keeps response shapes and generated types stable.
- **Error response (Stripe envelope)**:
  ```json
  { "error": { "type": "invalid_request_error", "code": "auth.emailAlreadyExists", "param": "email" } }
  ```
  - `type` ∈ `invalid_request_error` (400 / 404), `authentication_error` (401), `api_error` (500). No
    `permission_error` — cross-user access returns `404` (don't leak existence), so `403` is never emitted.
  - `code` carries the **i18n key** — the backend never returns user-facing text; the frontend maps the
    code to a translated message (see §10). `param` names the offending field when relevant.
  - HTTP status codes are semantic (`200`, `201`, `204`, `400`, `401`, `404`, `500`).
- **No idempotency keys**: `POST /v1/reviews` is guarded client-side — the frontend disables the submit
  button while the mutation is pending and TanStack Query mutations don't auto-retry, preventing a
  double-submit that would advance SM-2 twice.

### Auth & Account

| Method & Path | Auth | Body / Query | Response |
|---|---|---|---|
| `POST /v1/auth/signup` | public | `{ email, password, username }` | `201` `{ user, token }` |
| `POST /v1/auth/login` | public | `{ email, password }` | `200` `{ user, token }` |
| `GET /v1/me` | protected | — | `200` `User` |
| `PATCH /v1/me` | protected | `{ language?, theme?, dailyGoal? }` | `200` `User` |

### Subjects

| Method & Path | Auth | Body / Query | Response |
|---|---|---|---|
| `GET /v1/subjects` | protected | `?limit&starting_after&ending_before` | `200` list of `Subject` (each with computed `cardCount`) |
| `POST /v1/subjects` | protected | `{ title, description?, color?, icon? }` | `201` `Subject` |
| `GET /v1/subjects/:id` | protected | — | `200` `Subject` |
| `PATCH /v1/subjects/:id` | protected | `{ title?, description?, color?, icon? }` | `200` `Subject` |
| `DELETE /v1/subjects/:id` | protected | — | `204` (cascades to cards, progress, history) |
| `GET /v1/subjects/:id/stats` | protected | — | `200` `SubjectStats` |

### Cards

Cards are a top-level resource filtered by subject via a query param (Stripe-style, e.g. `?customer=`).

| Method & Path | Auth | Body / Query | Response |
|---|---|---|---|
| `GET /v1/cards` | protected | `?subject=:id` (required) `&limit&starting_after&ending_before` | `200` list of `Card` |
| `POST /v1/cards` | protected | `{ subjectId, question, answer, hints?, tags? }` | `201` `Card` |
| `GET /v1/cards/:id` | protected | — | `200` `Card` |
| `PATCH /v1/cards/:id` | protected | `{ question?, answer?, hints?, tags? }` | `200` `Card` |
| `DELETE /v1/cards/:id` | protected | — | `204` |

### Reviews & Review Queue

A **Review** is a creatable resource: submitting one (`POST /v1/reviews`) logs immutable review history
and updates the card's progress via SM-2.

| Method & Path | Auth | Body / Query | Response |
|---|---|---|---|
| `GET /v1/review_queue` | protected | `?subject=:id` (optional) | `200` `{ due: Card[], new: Card[], total: number }` |
| `GET /v1/review_queue/next` | protected | `?subject=:id` (optional) | `200` `Card` (next card to review) or `204` if empty |
| `POST /v1/reviews` | protected | `{ cardId, quality, timeSpent, wasHintUsed }` | `201` `CardProgress` |

### Dashboard

| Method & Path | Auth | Body / Query | Response |
|---|---|---|---|
| `GET /v1/dashboard/stats` | protected | `?period=7d\|30d` | `200` `DashboardStats` |
| `GET /v1/dashboard/weak_cards` | protected | `?limit` | `200` list of `Card` (with progress) |
| `GET /v1/dashboard/upcoming` | protected | — | `200` `{ today: number, tomorrow: number, thisWeek: number }` |

---

## 7. Spaced Repetition Algorithm (SM-2)

### Core Concepts
- **Interval**: Days until next review
- **Ease Factor**: Multiplier for interval growth (1.3–2.5, default: 2.5)
- **Repetitions**: Consecutive successful reviews
- **Quality**: User's self-assessed performance (1, 3, 4, or 5 via UI)

### Quality Scoring (Two-Step Hybrid)

| Step 1 | Step 2 | Quality |
|--------|--------|---------|
| Wrong | — | 1 |
| Right | Hard | 3 |
| Right | Good | 4 |
| Right | Easy | 5 |

If any hint was used during the review, quality is **capped at 3** regardless of self-assessment.

### Calculation Logic
```typescript
function calculateNextReview(
  quality: number,       // 1, 3, 4, or 5
  lastInterval: number,
  lastEaseFactor: number,
  repetitions: number
): { newInterval: number; newEaseFactor: number; newRepetitions: number } {

  const newEaseFactor = Math.max(
    1.3,
    lastEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  if (quality < 3) {
    // Failed — restart learning
    return { newInterval: 1, newEaseFactor, newRepetitions: 0 };
  }

  // Passed
  let newInterval: number;
  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(lastInterval * newEaseFactor);
  }

  return { newInterval, newEaseFactor, newRepetitions: repetitions + 1 };
}
```

### Card Status Progression
```
New (0 reviews)
  ↓
Learning (1–3 repetitions, interval < 7 days)
  ↓
Reviewing (stable interval, multiple repetitions)
  ↓
Mastered (interval > 21 days, high ease factor)
```

### Session Card Selection
1. Overdue cards first, ordered by staleness (most overdue first)
2. New cards to fill remaining capacity — capped at 30% of session total
3. Daily Goal (default: 20) is a visual target, not a hard limit
4. Session ends when no eligible cards remain or learner stops

---

## 8. Security & Authentication

### JWT Strategy
```typescript
// Token payload
{
  sub: "userId",
  email: "user@example.com",
  iat: timestamp,
  exp: timestamp + 24hours
}
```

- Token stored in localStorage (frontend)
- Sent via `Authorization: Bearer <token>` header
- Validated by a global Nest `JwtAuthGuard` (public routes opt out via `@Public()`)
- Logout is client-side only (remove token from localStorage)
- No refresh token, no server-side session

### Password Security
- Hashed with bcrypt (10 rounds)
- Never stored or transmitted in plain text

### Authorization
- The `JwtAuthGuard` validates the token on every protected route and sets `request.user`
- All data queries filter by `userId` — users only access their own data; cross-user access returns
  `404 invalid_request_error` (resource not found for this user), not `403`

### Input Validation
- All request params, query strings, and bodies validated with Zod schemas via `nestjs-zod`'s
  `ZodValidationPipe`; the same schemas (`createZodDto`) generate the OpenAPI spec
- Validation failures return `400 invalid_request_error` with the offending field in `error.param`
- Sanitize Markdown content to prevent XSS on render

---

## 9. Frontend Architecture

### State Management
- **Server state**: TanStack Query over a typed REST client. `api/client.ts` is an `openapi-fetch`
  instance (typed by the generated `api/schema.d.ts`) that injects the `Authorization` header; query
  hooks in `api/queries/` wrap it for fetching, caching, loading, errors, and invalidation
- **Client state**: React Context for AuthContext (JWT + user) and ThemeContext (dark/light)
- **Language**: react-i18next (no custom context)
- **Local UI state**: useState for forms, modals, toggles
- **API errors**: read `error.code` from the Stripe-style envelope and map it to an i18n message

### Review UI Flow
1. Card question displayed (rendered Markdown with syntax highlighting)
2. Learner may reveal hints one at a time (inline, sequential, fade-in animation)
3. Learner clicks "Reveal answer"
4. Answer appears below question (slide/fade animation, no card flip)
5. Two-step quality rating: "Wrong"/"Right", then (if right) "Hard"/"Good"/"Easy"
6. Next card or session summary

### Key Pages
- **LoginPage / SignupPage** — public, redirect to dashboard if authenticated
- **DashboardPage** — cards reviewed today vs. goal, streak, accuracy, weak cards, upcoming reviews
- **SubjectsPage** — list/create/edit subjects
- **LearningSessionPage** — the review flow described above
- **SettingsPage** — language, theme, daily goal

---

## 10. Internationalization (i18n)

- All translations live in the frontend (`react-i18next`)
- Backend never returns user-facing text — only error codes/keys (e.g., `auth.emailAlreadyExists`)
- Frontend maps error codes to translated strings
- Supported languages: English (`en.json`) and Portuguese (`pt.json`)

---

## 11. Code Quality Standards

### Linting & Formatting (Biome)
```json
{
  "organizeImports": true,
  "indentSize": 2,
  "useTabs": false,
  "lineWidth": 100,
  "trailingComma": "es5",
  "quotes": "single",
  "semicolons": "always",
  "arrowParentheses": "always"
}
```

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- No unused variables
- Strict null checks

### Git Hooks (Husky)

#### Pre-commit
```bash
biome check --write
pnpm type:check
```

#### Pre-push
```bash
pnpm test
pnpm type:check
```

### Testing Strategy

#### Frontend (Vitest)
- Unit tests for utilities and hooks (80%+ coverage)
- Component tests for critical UI components
- Integration tests for key user flows
- No snapshot tests

#### Backend (Vitest)
- Unit tests for service providers (80%+ coverage target)
- Integration tests with real SQLite database
- E2E tests for critical REST endpoint flows via `@nestjs/testing` + supertest (Nest test app)

### Naming Conventions
- **Components**: PascalCase (`LoginForm.tsx`)
- **Functions/Variables**: camelCase (`calculateInterval`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_CARD_INTERVAL`)
- **Types**: PascalCase (derived from Drizzle schema, not manually defined)
- **Files**: Components in PascalCase, everything else in camelCase
- **Tests**: `*.test.ts` or `*.spec.ts`

---

## 12. Development Workflow

### Project Setup
```bash
git clone <repo-url>
cd magic-cards
pnpm install
cp packages/backend/.env.example packages/backend/.env
```

### Running Development Servers
```bash
# Terminal 1: Backend (Fastify + REST)
pnpm --filter backend dev

# Terminal 2: Frontend (Vite)
pnpm --filter frontend dev
```

### Environment Variables

**Backend (.env)**
```
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h
DATABASE_PATH=./data/magic-cards.db
PORT=3001
```

### Common Commands
```bash
# Root (all packages)
pnpm dev              # Start all dev servers
pnpm test             # Run all tests
pnpm lint             # Biome check all packages
pnpm type:check       # TypeScript check all packages

# Per package
pnpm --filter backend dev
pnpm --filter frontend dev
pnpm --filter backend db:migrate    # Run Drizzle migrations
pnpm --filter backend db:generate   # Generate migration from schema changes
```

---

## 13. Implementation Phases

### Phase 0: Foundation
- [ ] Monorepo setup (pnpm workspaces, tsconfig, biome)
- [ ] Backend: NestJS (Fastify adapter) + REST (`/v1`) + Drizzle + SQLite scaffold
- [ ] Zod schemas + `nestjs-zod` + `@nestjs/swagger` (committed `openapi.json`, `/docs`, CI drift check)
- [ ] Database schema and initial migration (UUIDv7 IDs)
- [ ] Auth service (signup, login, JWT)
- [ ] `JwtAuthGuard` + global exception filter (Stripe error envelope) + list interceptor
- [ ] Frontend: Vite + React + TanStack Query + generated `openapi-fetch` client (`pnpm gen:api`)
- [ ] AuthContext + login/signup pages

### Phase 1: Core Learning
- [ ] Subject CRUD (routes + UI)
- [ ] Card CRUD (routes + UI)
- [ ] SM-2 algorithm service
- [ ] Learning session (card selection, review, progress tracking)
- [ ] Review history logging
- [ ] Basic learning session UI (question → hints → answer → quality rating)

### Phase 2: Frontend Polish
- [ ] Markdown rendering with syntax highlighting
- [ ] Review UI animations (slide/fade for answer reveal, fade-in for hints)
- [ ] Dark/Light theme (ThemeContext + Tailwind)
- [ ] Responsive design (mobile-first)
- [ ] i18n (English + Portuguese)

### Phase 3: Dashboard & Analytics
- [ ] Dashboard page with stats
- [ ] Streak tracking
- [ ] Accuracy rate (7d / 30d)
- [ ] Cards by status breakdown
- [ ] Weak cards identification
- [ ] Upcoming reviews forecast
- [ ] Daily goal progress bar

### Phase 4: Production Ready
- [ ] E2E testing
- [ ] Performance optimization
- [ ] Database migration to PostgreSQL (Drizzle dialect swap)
- [ ] Deployment setup
- [ ] Security audit

---

## 14. Key Design Decisions

See `docs/adr/` for detailed records. Summary:

| Decision | Rationale |
|----------|-----------|
| **SQLite over JSON Server** | Real relational DB, in-process, no extra server. See ADR 0001 |
| **Stripe-style REST (`/v1`) over tRPC** | Standard, versioned HTTP contract usable by any client; Stripe's list/error envelopes are proven ergonomics. See ADR 0003 (supersedes 0002) |
| **NestJS (Fastify adapter) over Fastify-standalone** | With REST back, the tRPC premise that killed NestJS is gone; guards/interceptors/filters map onto the Stripe auth + envelopes, `@nestjs/swagger` onto OpenAPI. See ADR 0004 |
| **`nestjs-zod` over class-validator DTOs** | Keeps Zod as single source of truth (validation + OpenAPI) rather than adopting Nest's class-validator idiom |
| **OpenAPI + generated client for type safety** | Replaces tRPC's inference; Zod → OpenAPI 3.1 → typed TS client preserves compile-time safety at the cost of a codegen step (committed spec, CI drift check) |
| **Conventional REST verbs (POST/PATCH/PUT/DELETE)** | Clearer than Stripe's POST-for-everything; JSON bodies over Stripe's legacy form-encoding |
| **Drizzle over Prisma** | SQL-close (good for the aggregation-heavy dashboard/streak queries), no query engine, clean SQLite→PostgreSQL swap. Kept after review — no premise changed. See ADR 0004 |
| **No repository pattern** | Drizzle is the abstraction; repositories would be passthrough boilerplate |
| **Zod for validation** | Single source of truth — drives request validation, the OpenAPI spec, and aligns with Drizzle |
| **UUIDv7 IDs** | Time-sortable, so list endpoints use the `id` directly as a pagination cursor |
| **No `expand[]`, no idempotency keys** | Single first-party client joins from cache; double-submit prevented client-side — Stripe machinery not worth the cost |
| **pnpm monorepo** | Frontend generates types from the backend's OpenAPI spec (`pnpm gen:api`) |
| **TanStack Query for server state** | Replaces manual fetch hooks and API cache contexts |
| **JWT + email/password** | Stateless, simple, sufficient for educational app scope |
| **Client-side logout** | No server state to invalidate; remove token from localStorage |
| **No static card difficulty** | SM-2 discovers difficulty dynamically via ease factor |
| **No cardCount on Subject** | Computed on demand to avoid denormalization bugs |
| **Hint usage caps quality at 3** | Ensures cards needing hints are scheduled sooner |
| **i18n frontend-only** | Backend returns error codes, frontend translates |
| **Tailwind + shadcn/ui** | Fast development, consistent design system |
| **TanStack Router** | Type-safe routing, integrates with TanStack Query ecosystem already in use |
| **Biome for linting** | Fast, zero-config, built-in formatter |
| **SM-2 Algorithm** | Proven spaced repetition method, balances simplicity and effectiveness |

---

## 15. References & Resources

### Spaced Repetition
- SM-2 Algorithm: https://supermemo.guru/wiki/SuperMemo_2
- Anki Algorithm: https://docs.ankiweb.net/studying.html
- Forgetting Curve: https://en.wikipedia.org/wiki/Forgetting_curve

### Technologies
- [Stripe API Reference (design conventions)](https://stripe.com/docs/api)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS OpenAPI (`@nestjs/swagger`)](https://docs.nestjs.com/openapi/introduction)
- [nestjs-zod](https://github.com/risen228/nestjs-zod)
- [openapi-typescript / openapi-fetch](https://openapi-ts.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query/latest)

---

**Document Version**: 3.1
**Last Updated**: 2026-05-31
**Status**: Architecture Refined (NestJS on Fastify · REST / Stripe-style / OpenAPI) — Ready for Implementation
