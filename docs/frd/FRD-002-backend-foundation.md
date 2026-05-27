# FRD-002: Backend Foundation

**Status**: Ready for Implementation
**Phase**: 1 — Foundation
**Date**: 2026-05-27
**Depends on**: FRD-001 (UI validated and approved)

---

## Problem Statement

After validating the UI prototype, the application needs a real backend to persist data and handle authentication. The monorepo structure, database schema, tRPC server, and auth flow must be established as the foundation for all subsequent features.

## Solution

Set up the pnpm monorepo with backend and frontend packages. Build the Fastify + tRPC + Drizzle backend scaffold with SQLite, implement the full database schema, and wire up JWT-based authentication. Connect the frontend AuthContext to real tRPC procedures, replacing mock data for auth flows.

## User Stories

1. As a learner, I want to sign up with email, password, and username, so that I can create my account.
2. As a learner, I want to log in with my email and password, so that I can access my data.
3. As a learner, I want to stay logged in across page refreshes (JWT in localStorage), so that I don't have to re-authenticate on every visit.
4. As a learner, I want to log out by clicking a button, so that I can end my session (client-side token removal).
5. As a learner, I want to see my profile info after login (via `auth.me`), so that the app shows my username and preferences.
6. As a learner, I want to update my preferences (language, theme, daily goal), so that the app adapts to my choices.
7. As a developer, I want end-to-end type safety from database to frontend, so that type errors are caught at compile time.
8. As a developer, I want tRPC procedures validated with Zod, so that invalid input is rejected before reaching business logic.
9. As a developer, I want a protectedProcedure middleware, so that all non-auth routes require a valid JWT.
10. As a developer, I want Drizzle migrations, so that schema changes are versioned and reproducible.

## Implementation Decisions

- **Monorepo**: pnpm workspaces with `packages/backend` and `packages/frontend`. Root `package.json` has workspace scripts (`pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm type:check`).
- **Database**: SQLite via better-sqlite3. Drizzle ORM for schema definition and queries. All five tables as defined in architecture.md section 4: `users`, `subjects`, `cards`, `cardProgress`, `reviewHistory`.
- **All tables created upfront**: Even though subjects/cards/learning aren't used in this phase, the schema should be complete to validate the full relational design with foreign keys and constraints.
- **tRPC setup**: `trpc.ts` initializes tRPC with `publicProcedure` and `protectedProcedure`. `context.ts` extracts the JWT from the Authorization header. `middleware/auth.ts` validates the token and injects `userId` into context.
- **Auth service**: `auth.service.ts` with `hashPassword` (bcrypt, 10 rounds), `verifyPassword`, `signToken` (JWT, 24h expiry), `verifyToken`. Token payload: `{ sub: userId, email, iat, exp }`.
- **Auth router**: `auth.signup` (public mutation), `auth.login` (public mutation), `auth.me` (protected query), `auth.updatePreferences` (protected mutation). Input validated with Zod. Duplicate email returns error code `auth.emailAlreadyExists`.
- **Fastify server**: `server.ts` boots Fastify, registers CORS (allowing frontend origin), registers tRPC Fastify adapter with the appRouter.
- **Frontend connection**: Replace mock AuthContext with real tRPC calls. `trpc.ts` sets up the tRPC client with `httpBatchLink` pointing to `localhost:3001`. Authorization header injected from localStorage token.
- **Environment variables**: Backend reads from `.env` — `JWT_SECRET`, `JWT_EXPIRATION`, `DATABASE_PATH`, `PORT`, `NODE_ENV`.
- **Error codes**: Backend returns error codes as strings (e.g., `auth.emailAlreadyExists`, `auth.invalidCredentials`). Frontend maps these to translated messages via i18n.

## Testing Decisions

No tests in this phase. Validation is manual — signup, login, refresh, logout, and preference update flows verified in the browser.

## Out of Scope

- Subject CRUD procedures and UI integration
- Card CRUD procedures and UI integration
- SM-2 algorithm
- Learning session logic
- Dashboard stats procedures
- Automated tests
- Deployment

## Further Notes

- The database schema includes all tables (not just users) because foreign key relationships need to be validated upfront and migrations should be sequential.
- After this phase, auth pages are fully functional with real data. All other pages still use mock data from FRD-001.
- The `protectedProcedure` middleware established here is the foundation for every subsequent router.
