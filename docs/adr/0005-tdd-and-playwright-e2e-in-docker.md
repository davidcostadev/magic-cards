# ADR 0005: Test-Driven Development + full-stack Playwright E2E in Docker

- **Status**: Accepted
- **Date**: 2026-05-31
- **Deciders**: David Costa

## Context

The earlier plan deferred automated testing to the last phase (FRD-006), with FRD-001/002/003/005 each
stating "No tests in this phase — validation is manual." That leaves the most critical logic (SM-2
scheduling, learning-session selection, auth) unverified until the end, when it is hardest and riskiest
to retrofit tests.

We want to build features **test-first (TDD)** across both backend and frontend, and to verify the
**whole stack together** — a real browser driving the real frontend against the real backend — rather
than only testing each side in isolation.

## Decision

1. **TDD by default.** Every backend and frontend *functionality* is written test-first: write a failing
   test (red), implement the minimum to pass (green), refactor. This applies to backend service providers
   and endpoints, and to frontend logic/hooks/components — not to pure visual scaffolding (the FRD-001
   prototype) or styling-only polish (FRD-004).
   - **Unit/integration** runner: **Vitest** (both packages).
   - Backend integration: `@nestjs/testing` + **supertest** against a real (file/in-memory) SQLite DB.
   - Frontend component: React Testing Library.

2. **Full-stack E2E with Playwright, in Docker.** A browser-level suite drives the frontend against a
   running backend. The stack runs via **`docker compose`** (backend + frontend, backend pointed at a
   throwaway SQLite DB seeded per run) so the environment is identical locally and in CI. Playwright runs
   the canonical flows: signup → create subject → create cards → study session → review → dashboard
   reflects the result.

## Options considered

- **Test-after / manual-until-Phase-4** (the old plan) — fastest initial velocity, but the SM-2 and
  session logic stay unverified longest; rejected.
- **E2E tool**: **Playwright** (chosen — first-class TypeScript, multi-browser, fast, good trace/debug)
  vs. Cypress (single-process model, heavier) vs. API-only E2E (supertest — kept for endpoint flows, but
  it doesn't exercise the browser/UI).
- **E2E environment**: **Docker compose front+back** (chosen — reproducible, matches CI, true full-stack)
  vs. running both dev servers locally and pointing Playwright at them (simpler, but environment drift
  between machines and CI).

## Consequences

- **Slower first-pass feature velocity, higher confidence** — especially for SM-2, where regressions are
  silent and corrupt scheduling.
- **The "No tests in this phase" notes in FRD-002/003/005 are superseded** — those phases now build their
  features test-first. FRD-006 no longer "introduces" testing; it adds the **Playwright E2E suite +
  Docker compose + CI pipeline + coverage gates**.
- **New artifacts**: `e2e/` (Playwright specs + `playwright.config.ts`), `docker-compose.e2e.yml`, and
  per-package Dockerfiles. `pnpm test` (unit/integration, watchable for TDD) and `pnpm test:e2e`
  (Playwright against the Docker stack).
- **CI runs both layers**: Vitest (unit/integration) on every push; the Dockerized Playwright suite on PRs.
- Coverage target stays **80%+** on backend services and critical frontend logic.

## References

- Playwright: https://playwright.dev/
- Vitest: https://vitest.dev/
- Testing Library: https://testing-library.com/
- NestJS testing: https://docs.nestjs.com/fundamentals/testing
