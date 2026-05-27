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
- **Server State**: TanStack Query via `@trpc/react-query`
- **Client State**: React Context (AuthContext, ThemeContext)
- **Markdown Rendering**: react-markdown with syntax highlighting (e.g., rehype-highlight or shiki)
- **Testing**: Vitest + React Testing Library
- **Code Quality**: Biome (linter + formatter)
- **i18n**: react-i18next

### Backend
- **HTTP Server**: Fastify
- **API Layer**: tRPC (Fastify adapter)
- **Database**: SQLite (in-process via better-sqlite3)
- **ORM**: Drizzle ORM
- **Validation**: Zod (shared with tRPC input schemas)
- **Testing**: Vitest
- **Code Quality**: Biome (linter + formatter)
- **Authentication**: JWT (jose or jsonwebtoken) + bcrypt
- **Environment**: Node.js 18+

### Monorepo
- **Package Manager**: pnpm workspaces
- **Structure**: `packages/frontend` + `packages/backend`
- **Type Sharing**: Frontend imports `AppRouter` type from backend package — end-to-end type safety with zero codegen

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
│   │       ├── db/
│   │       │   ├── schema.ts         # Drizzle table definitions
│   │       │   ├── client.ts         # SQLite connection
│   │       │   └── migrations/       # Drizzle Kit migrations
│   │       ├── routers/
│   │       │   ├── auth.ts           # signup, login, me
│   │       │   ├── subjects.ts       # CRUD subjects
│   │       │   ├── cards.ts          # CRUD cards
│   │       │   ├── learning.ts       # session, review, stats
│   │       │   └── index.ts          # appRouter (merges all routers)
│   │       ├── services/
│   │       │   ├── auth.service.ts   # password hashing, JWT sign/verify
│   │       │   ├── learning.service.ts # session card selection, stats
│   │       │   └── sm2.service.ts    # spaced repetition algorithm
│   │       ├── middleware/
│   │       │   └── auth.ts           # JWT validation → protectedProcedure
│   │       ├── context.ts            # tRPC context creation
│   │       ├── trpc.ts               # tRPC init + procedure builders
│   │       └── server.ts             # Fastify + tRPC plugin boot
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
│           ├── utils/
│           │   ├── cn.ts
│           │   ├── formatters.ts
│           │   └── trpc.ts           # tRPC client + React Query setup
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

## 5. Backend Architecture (Fastify + tRPC)

### Layers

#### Routers (Presentation)
- Receive tRPC procedure calls
- Validate input with Zod schemas
- Delegate to services (when business logic exists) or query Drizzle directly (for simple CRUD)
- No business logic in routers

#### Services (Business Logic)
- Plain TypeScript modules, independent of tRPC and Fastify
- Only created when real logic exists:
  - `auth.service.ts` — password hashing, JWT sign/verify
  - `sm2.service.ts` — spaced repetition algorithm
  - `learning.service.ts` — session card selection, stats computation
- Simple CRUD does not warrant a service

#### Database (Infrastructure)
- Drizzle schema + SQLite client
- No repository layer — Drizzle is the abstraction
- Migration from SQLite to PostgreSQL requires changing the Drizzle dialect, not rewriting queries

### Authentication Flow
- `publicProcedure` — accessible without auth (signup, login)
- `protectedProcedure` — requires valid JWT in `Authorization: Bearer <token>` header
- tRPC middleware extracts and validates the token, injects `userId` into context
- Logout is 100% client-side (remove token from localStorage)

---

## 6. tRPC Procedures

### Auth Router (`auth.*`)

| Procedure | Type | Auth | Input | Output |
|-----------|------|------|-------|--------|
| `auth.signup` | mutation | public | `{ email, password, username }` | `{ user, token }` |
| `auth.login` | mutation | public | `{ email, password }` | `{ user, token }` |
| `auth.me` | query | protected | — | `User` |
| `auth.updatePreferences` | mutation | protected | `{ language?, theme?, dailyGoal? }` | `User` |

### Subjects Router (`subjects.*`)

| Procedure | Type | Auth | Input | Output |
|-----------|------|------|-------|--------|
| `subjects.list` | query | protected | — | `Subject[]` (with computed card count) |
| `subjects.getById` | query | protected | `{ id }` | `Subject` |
| `subjects.create` | mutation | protected | `{ title, description?, color?, icon? }` | `Subject` |
| `subjects.update` | mutation | protected | `{ id, title?, description?, color?, icon? }` | `Subject` |
| `subjects.delete` | mutation | protected | `{ id }` | `void` |
| `subjects.stats` | query | protected | `{ id }` | `SubjectStats` |

### Cards Router (`cards.*`)

| Procedure | Type | Auth | Input | Output |
|-----------|------|------|-------|--------|
| `cards.listBySubject` | query | protected | `{ subjectId }` | `Card[]` |
| `cards.getById` | query | protected | `{ id }` | `Card` |
| `cards.create` | mutation | protected | `{ subjectId, question, answer, hints?, tags? }` | `Card` |
| `cards.update` | mutation | protected | `{ id, question?, answer?, hints?, tags? }` | `Card` |
| `cards.delete` | mutation | protected | `{ id }` | `void` |

### Learning Router (`learning.*`)

| Procedure | Type | Auth | Input | Output |
|-----------|------|------|-------|--------|
| `learning.today` | query | protected | `{ subjectId? }` | `{ due: Card[], new: Card[], total: number }` |
| `learning.session` | query | protected | `{ subjectId? }` | `Card` (next card to review) |
| `learning.review` | mutation | protected | `{ cardId, quality, timeSpent, wasHintUsed }` | `CardProgress` |
| `learning.stats` | query | protected | `{ period?: '7d' \| '30d' }` | `DashboardStats` |
| `learning.weakCards` | query | protected | `{ limit? }` | `Card[]` (with progress) |
| `learning.upcoming` | query | protected | — | `{ today: number, tomorrow: number, thisWeek: number }` |

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
- Validated in tRPC middleware → `protectedProcedure`
- Logout is client-side only (remove token from localStorage)
- No refresh token, no server-side session

### Password Security
- Hashed with bcrypt (10 rounds)
- Never stored or transmitted in plain text

### Authorization
- `protectedProcedure` middleware validates JWT on every call
- All data queries filter by `userId` from JWT — users only access their own data

### Input Validation
- All tRPC inputs validated with Zod schemas
- Sanitize Markdown content to prevent XSS on render

---

## 9. Frontend Architecture

### State Management
- **Server state**: TanStack Query via `@trpc/react-query` — handles fetching, caching, loading, errors, invalidation
- **Client state**: React Context for AuthContext (JWT + user) and ThemeContext (dark/light)
- **Language**: react-i18next (no custom context)
- **Local UI state**: useState for forms, modals, toggles

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
- Unit tests for services (80%+ coverage target)
- Integration tests with real SQLite database
- E2E tests for critical tRPC procedure flows

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
# Terminal 1: Backend (Fastify + tRPC)
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
- [ ] Backend: Fastify + tRPC + Drizzle + SQLite scaffold
- [ ] Database schema and initial migration
- [ ] Auth service (signup, login, JWT)
- [ ] tRPC context + protectedProcedure middleware
- [ ] Frontend: Vite + React + tRPC client setup
- [ ] AuthContext + login/signup pages

### Phase 1: Core Learning
- [ ] Subject CRUD (router + UI)
- [ ] Card CRUD (router + UI)
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
| **Fastify + tRPC over NestJS + REST** | End-to-end type safety, less boilerplate, NestJS infra unused with tRPC. See ADR 0002 |
| **Drizzle over TypeORM/Prisma** | Lightweight, type-safe, SQL-close, easy SQLite→PostgreSQL swap |
| **No repository pattern** | Drizzle is the abstraction; repositories would be passthrough boilerplate |
| **Zod for validation** | Shared between tRPC input and Drizzle, single source of truth |
| **pnpm monorepo** | Frontend imports backend types directly, no codegen |
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
- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query/latest)

---

**Document Version**: 2.0
**Last Updated**: 2026-05-27
**Status**: Architecture Refined — Ready for Implementation
