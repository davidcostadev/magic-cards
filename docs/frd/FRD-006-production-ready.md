# FRD-006: Production Ready

**Status**: Ready for Implementation
**Phase**: 5 — Production
**Date**: 2026-05-27
**Depends on**: FRD-005 (All features complete)

---

## Problem Statement

The application is feature-complete but runs only in development mode with SQLite. Before going to production, it needs automated test coverage, performance optimization, a production-grade database, and a deployment pipeline.

## Solution

Add comprehensive automated tests, migrate from SQLite to PostgreSQL via Drizzle dialect swap, optimize frontend bundle and backend query performance, conduct a security audit, and set up deployment infrastructure.

## User Stories

1. As a developer, I want automated tests covering SM-2 algorithm edge cases, so that scheduling logic is verified beyond manual testing.
2. As a developer, I want integration tests for tRPC procedures with a real database, so that I catch query and validation bugs.
3. As a developer, I want component tests for the review flow (CardReview, QualityButtons), so that the critical UI interaction is protected from regressions.
4. As a developer, I want E2E tests for the full learning loop (signup → create subject → create card → review → verify schedule), so that the system works end-to-end.
5. As a developer, I want 80%+ code coverage on backend services, so that business logic is well-tested.
6. As a developer, I want the database to be PostgreSQL in production, so that the app can handle concurrent users and larger datasets.
7. As a developer, I want the SQLite → PostgreSQL migration to require only a Drizzle dialect change, so that no queries are rewritten.
8. As a developer, I want the frontend bundle optimized (code splitting, lazy loading routes), so that initial load time is fast.
9. As a developer, I want database queries to use appropriate indexes, so that list and stats queries perform well.
10. As a developer, I want a security audit covering JWT handling, input validation, Markdown sanitization, and authorization checks, so that the app is safe for public use.
11. As a developer, I want the app deployed with a CI/CD pipeline, so that changes are automatically tested and deployed.
12. As a learner, I want the app to load in under 3 seconds on a 4G connection, so that I can start studying quickly.

## Implementation Decisions

- **Test framework**: Vitest for both backend and frontend. React Testing Library for component tests.
- **Backend tests**: Unit tests for `sm2.service` (known input/output pairs from SM-2 spec), `auth.service` (hash/verify, sign/verify token), `learning.service` (card selection logic, review submission). Integration tests for each router using a test SQLite database.
- **Frontend tests**: Component tests for CardReview, QualityButtons, HintReveal (the review flow). Utility tests for formatters and helpers.
- **E2E tests**: Vitest with a test server instance. Full user flow: signup → create subject → create cards → start session → complete reviews → verify dashboard stats.
- **PostgreSQL migration**: Change Drizzle config from `better-sqlite3` dialect to `pg` dialect. Update connection string. Run `db:generate` for PostgreSQL-specific migration. Adjust any SQLite-specific syntax (e.g., `integer` booleans → native `boolean`).
- **Performance**: Frontend — route-level code splitting with React.lazy and Suspense. Backend — add indexes on `cardProgress(userId, nextReviewDate)`, `reviewHistory(userId, reviewedAt)`, `subjects(userId)`, `cards(subjectId)`.
- **Security audit checklist**: JWT secret is strong and from environment variable; passwords hashed with bcrypt; all inputs validated with Zod; Markdown output sanitized (XSS prevention); all queries filter by `userId` (no cross-user data access); CORS configured to allow only the frontend origin; rate limiting on auth endpoints.
- **Deployment**: To be determined based on hosting choice (Vercel/Netlify for frontend, Railway/Fly.io for backend, or a unified platform). CI/CD with GitHub Actions: lint → type-check → test → build → deploy.

## Testing Decisions

This is the phase where automated tests are introduced. Target:
- 80%+ coverage on backend services (`sm2.service`, `learning.service`, `auth.service`)
- Integration tests for all tRPC routers (real SQLite database in test)
- Component tests for the review flow UI
- At least one E2E test covering the full learning loop
- Tests should verify external behavior, not implementation details
- No snapshot tests (as defined in architecture.md)

## Out of Scope

- Feature additions (all features complete in prior phases)
- Mobile native app (React Native)
- User management admin panel
- Multi-tenant / organization features
- Offline support / PWA

## Further Notes

- The SQLite → PostgreSQL migration is designed to be low-risk because Drizzle abstracts the dialect. The main changes are: connection config, boolean representation, and potentially timestamp handling.
- Security audit should be done before any public deployment. Focus on the OWASP Top 10 relevant to this stack: injection (Zod mitigates), XSS (Markdown sanitization), broken auth (JWT validation), and broken access control (userId filtering).
- Performance optimization should be data-driven. Measure before optimizing — the app may already be fast enough with SQLite for the expected user base.
