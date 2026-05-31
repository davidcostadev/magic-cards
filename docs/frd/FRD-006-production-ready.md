# FRD-006: Production Ready

**Status**: Ready for Implementation
**Phase**: 5 — Production
**Date**: 2026-05-27
**Depends on**: FRD-005 (All features complete)

---

## Problem Statement

The application is feature-complete and — because features were built TDD-style (ADR 0005) — already has unit/integration coverage. It runs only in development mode with SQLite. Before going to production it needs the full-stack E2E suite hardened and wired into CI, performance optimization, a production-grade database, and a deployment pipeline.

## Solution

Harden the Playwright full-stack E2E suite running against the Dockerized front+back stack, wire the CI pipeline (lint → type-check → unit/integration → E2E → build → deploy) with coverage gates, migrate from SQLite to PostgreSQL via Drizzle dialect swap, optimize frontend bundle and backend query performance, conduct a security audit, and set up deployment infrastructure.

## User Stories

1. As a developer, I want the SM-2 algorithm edge cases covered by tests (written test-first in FRD-003), so that scheduling logic is verified.
2. As a developer, I want integration tests for the REST endpoints with a real database, so that I catch query and validation bugs.
3. As a developer, I want component tests for the review flow (CardReview, QualityButtons), so that the critical UI interaction is protected from regressions.
4. As a developer, I want a full-stack Playwright E2E suite (signup → create subject → create card → review → verify schedule + dashboard) running against the Dockerized front+back stack, so that the system is verified end-to-end in a CI-identical environment.
5. As a developer, I want 80%+ code coverage on backend services enforced as a CI gate, so that business logic stays well-tested.
6. As a developer, I want the database to be PostgreSQL in production, so that the app can handle concurrent users and larger datasets.
7. As a developer, I want the SQLite → PostgreSQL migration to require only a Drizzle dialect change, so that no queries are rewritten.
8. As a developer, I want the frontend bundle optimized (code splitting, lazy loading routes), so that initial load time is fast.
9. As a developer, I want database queries to use appropriate indexes, so that list and stats queries perform well.
10. As a developer, I want a security audit covering JWT handling, input validation, Markdown sanitization, and authorization checks, so that the app is safe for public use.
11. As a developer, I want the app deployed with a CI/CD pipeline, so that changes are automatically tested and deployed.
12. As a learner, I want the app to load in under 3 seconds on a 4G connection, so that I can start studying quickly.

## Implementation Decisions

- **Test framework**: Vitest (unit/integration, both packages), React Testing Library (components), Playwright (E2E). Most of these tests already exist — they were written test-first in FRD-002/003/005; this phase fills coverage gaps and adds the Dockerized E2E suite.
- **Backend tests**: Unit for `sm2.service` (known input/output pairs from SM-2 spec), `auth.service` (hash/verify, sign/verify token), `learning.service` (card selection, review submission). Integration for each Nest module via `@nestjs/testing` + supertest against a test SQLite database.
- **Frontend tests**: Component tests for CardReview, QualityButtons, HintReveal (the review flow). Utility tests for formatters and helpers.
- **E2E tests**: Playwright driving a real browser against the full stack brought up by `docker-compose.e2e.yml` (backend + frontend, throwaway SQLite seeded per run). Full flow: signup → create subject → create cards → start session → complete reviews → verify dashboard stats.
- **PostgreSQL migration**: Change Drizzle config from `better-sqlite3` dialect to `pg` dialect. Update connection string. Run `db:generate` for PostgreSQL-specific migration. Adjust any SQLite-specific syntax (e.g., `integer` booleans → native `boolean`).
- **Performance**: Frontend — route-level code splitting with React.lazy and Suspense. Backend — add indexes on `cardProgress(userId, nextReviewDate)`, `reviewHistory(userId, reviewedAt)`, `subjects(userId)`, `cards(subjectId)`.
- **Security audit checklist**: JWT secret is strong and from environment variable; passwords hashed with bcrypt; all inputs validated with Zod; Markdown output sanitized (XSS prevention); all queries filter by `userId` (no cross-user data access); CORS configured to allow only the frontend origin; rate limiting on auth endpoints.
- **Deployment**: To be determined based on hosting choice (Vercel/Netlify for frontend, Railway/Fly.io for backend, or a unified platform). CI/CD with GitHub Actions: lint → type-check → unit/integration (Vitest) → E2E (Playwright in Docker) → build → deploy.

## Testing Decisions

Automated tests are **not introduced here** — they were written test-first from FRD-002 onward (ADR 0005). This phase consolidates and hardens them. Target:
- 80%+ coverage on backend services (`sm2.service`, `learning.service`, `auth.service`), enforced as a CI gate
- Integration tests for all Nest modules via `@nestjs/testing` + supertest (real SQLite database in test)
- Component tests for the review flow UI
- The full-stack Playwright E2E suite (Dockerized front+back) covering the complete learning loop, running in CI
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
