# FRD-002: Backend Foundation

**Status**: Ready for Implementation
**Phase**: 1 — Foundation
**Date**: 2026-05-27
**Depends on**: FRD-001 (UI validated and approved)

---

## Problem Statement

After validating the UI prototype, the application needs a real backend to persist data and handle authentication. The monorepo structure, database schema, REST API server (`/v1`), and auth flow must be established as the foundation for all subsequent features.

## Solution

Set up the pnpm monorepo with backend and frontend packages. Build the NestJS (Fastify adapter) + REST + Drizzle backend scaffold with SQLite, implement the full database schema, expose a versioned `/v1` API documented via OpenAPI, and wire up JWT-based authentication. Connect the frontend AuthContext to the real REST endpoints (via a generated typed client), replacing mock data for auth flows.

## User Stories

1. As a learner, I want to sign up with email, password, and username, so that I can create my account.
2. As a learner, I want to log in with my email and password, so that I can access my data.
3. As a learner, I want to stay logged in across page refreshes (JWT in localStorage), so that I don't have to re-authenticate on every visit.
4. As a learner, I want to log out by clicking a button, so that I can end my session (client-side token removal).
5. As a learner, I want to see my profile info after login (via `auth.me`), so that the app shows my username and preferences.
6. As a learner, I want to update my preferences (language, theme, daily goal), so that the app adapts to my choices.
7. As a developer, I want end-to-end type safety from database to frontend (via an OpenAPI spec and a generated client), so that type errors are caught at compile time.
8. As a developer, I want REST endpoints validated with Zod, so that invalid input is rejected before reaching business logic.
9. As a developer, I want a JWT auth guard (`JwtAuthGuard`), so that all non-auth routes require a valid token.
10. As a developer, I want Drizzle migrations, so that schema changes are versioned and reproducible.
11. As a developer, I want the API documented as OpenAPI (swagger UI at `/docs`), so that the contract is browsable and the frontend client can be generated from it.

## Implementation Decisions

- **Monorepo**: pnpm workspaces with `packages/backend` and `packages/frontend`. Root `package.json` has workspace scripts (`pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm type:check`).
- **Database**: SQLite via better-sqlite3. Drizzle ORM for schema definition and queries. All five tables as defined in architecture.md section 4: `users`, `subjects`, `cards`, `cardProgress`, `reviewHistory`.
- **All tables created upfront**: Even though subjects/cards/learning aren't used in this phase, the schema should be complete to validate the full relational design with foreign keys and constraints.
- **API setup**: NestJS on the Fastify adapter (`@nestjs/platform-fastify`). `nestjs-zod` (`ZodValidationPipe` registered globally + `createZodDto`) handles per-endpoint request validation and typing. `@nestjs/swagger` (patched via `patchNestjsSwagger`) emits the OpenAPI 3.1 spec and serves docs at `/docs`. A global `HttpExceptionFilter` produces the Stripe-style error envelope; a global list interceptor wraps collections; `common/pagination.ts` holds the UUIDv7 cursor helpers. A global `JwtAuthGuard` validates the token and sets `request.user` (public routes opt out via `@Public()`).
- **Auth service**: `auth.service.ts` (Nest provider) with `hashPassword` (bcrypt, 10 rounds), `verifyPassword`, `signToken` (JWT, 24h expiry), `verifyToken`. Token payload: `{ sub: userId, email, iat, exp }`.
- **Auth module** (`auth.controller.ts` + `auth.service.ts`): `POST /v1/auth/signup` (public), `POST /v1/auth/login` (public), `GET /v1/me` (protected), `PATCH /v1/me` (protected). Input validated with Zod DTOs. Duplicate email returns `400` with error `code` `auth.emailAlreadyExists`; bad credentials return `401` `auth.invalidCredentials`.
- **Bootstrap**: `main.ts` boots Nest on the Fastify adapter, registers CORS (allowing frontend origin), swagger, the global validation pipe / exception filter / list interceptor / `JwtAuthGuard`, and sets the global `/v1` prefix.
- **Frontend connection**: Replace mock AuthContext with real REST calls. `api/client.ts` is an `openapi-fetch` client (typed by `api/schema.d.ts`, generated via `pnpm gen:api`) pointing to `localhost:3001`, injecting the `Authorization` header from the localStorage token. TanStack Query wraps the calls.
- **Environment variables**: Backend reads from `.env` — `JWT_SECRET`, `JWT_EXPIRATION`, `DATABASE_PATH`, `PORT`, `NODE_ENV`.
- **Error codes**: Backend returns error codes as strings (e.g., `auth.emailAlreadyExists`, `auth.invalidCredentials`). Frontend maps these to translated messages via i18n.

## Testing Decisions

No tests in this phase. Validation is manual — signup, login, refresh, logout, and preference update flows verified in the browser.

## Out of Scope

- Subject CRUD endpoints and UI integration
- Card CRUD endpoints and UI integration
- SM-2 algorithm
- Learning session logic
- Dashboard stats endpoints
- Automated tests
- Deployment

## Further Notes

- The database schema includes all tables (not just users) because foreign key relationships need to be validated upfront and migrations should be sequential.
- After this phase, auth pages are fully functional with real data. All other pages still use mock data from FRD-001.
- The `JwtAuthGuard`, the global exception filter / list interceptor, the OpenAPI/swagger setup, and the Stripe-style envelopes established here are the foundation for every subsequent Nest module.
