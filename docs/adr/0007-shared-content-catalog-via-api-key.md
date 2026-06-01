# ADR 0007: Shared content catalog via an API key

- **Status**: Accepted
- **Date**: 2026-06-01
- **Deciders**: David Costa

## Context

Subjects and cards are private and per-user (JWT-scoped): each learner builds their own
deck. We wanted a way to publish **shared/curated content** that every learner can study,
contributed by a trusted operator (or a seeding script / CMS) — without opening the regular
user endpoints to public writes.

## Options considered

1. **Browse & import catalog** — users copy shared content into their own account. Keeps
   reads per-user (less invasive) but adds an import step and duplicates data per user.
2. **Auto-available public content behind an API key** — a trusted key publishes content
   that shows up directly in every learner's lists and study queue, read-only. Chosen.

## Decision

- Subjects gain an **`isPublic`** flag. Public content is owned by a seeded **system user**
  (`SYSTEM_USER_ID`, an unusable password hash — it can't log in).
- A static **`CONTENT_API_KEY`** (env) authorizes the catalog endpoints via an `x-api-key`
  header (`ApiKeyGuard`, constant-time compare). If the key is unset, the catalog is
  disabled (all catalog requests denied). The key scope is **catalog content only**:
  `POST /v1/catalog/subjects`, `POST /v1/catalog/cards`, and
  `DELETE /v1/catalog/subjects/:id` (scoped to public, system-owned subjects, so it can
  never delete a user's content). These routes are `@Public()` to the JWT guard and gated
  solely by the API key. A repeatable, idempotent `seed:catalog` script publishes example
  content through the same data path (fixed ids + upsert).
- **Reads union public content.** Authorization split into two predicates
  (`common/visibility.ts`): `ownsSubject` for mutations and `canSeeSubject` (own **or**
  public) for reads. Applied to subjects/cards reads, the learning session + review
  submission, and the dashboard's available-card count.
- **Public content is read-only to users**: mutations still require ownership, so a user
  editing/deleting public content gets `404`. Per-user progress and review history work on
  public cards exactly as on private ones (they're keyed by `(userId, cardId)`).

## Consequences

- Operators can publish a shared catalog that's instantly available to every learner; no
  import step, no per-user duplication.
- The split read/write predicates are the load-bearing invariant — every read uses
  `canSeeSubject`, every mutation stays owner-only. New endpoints must follow the same rule.
- The API key is a new, narrow auth surface (publish-only). It must be a long random secret;
  rotating it just changes the env var. It does not grant any user-data access.
- This is **not** a community/UGC system — there's no per-user public publishing or
  moderation. Adding that later would build on `isPublic` but needs its own authz + review.
