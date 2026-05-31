# ADR 0003: Stripe-style REST + OpenAPI instead of tRPC

- **Status**: Accepted (transport/structure refined by [ADR 0004](./0004-nestjs-fastify-adapter-with-zod-drizzle.md))
- **Date**: 2026-05-31
- **Deciders**: David Costa
- **Supersedes**: ADR 0002 (the tRPC portion — Drizzle + Zod are retained)

> **Refinement (ADR 0004):** the REST/Stripe/OpenAPI decision below stands. ADR 0004 only changes *who
> serves it* — **NestJS on the Fastify adapter** instead of Fastify standalone — and *how* the
> cross-cutting concerns are implemented (Nest guard/filter/interceptor instead of hand-rolled). It also
> dropped two pragmatic-profile items after review: `expand[]` and `Idempotency-Key` (see below).

## Context

ADR 0002 chose **tRPC** as the API layer, primarily for end-to-end type safety with zero codegen. tRPC
was never implemented: `packages/backend/src/` is still empty and the frontend runs entirely on mock data
(`packages/frontend/src/mocks/`), with no tRPC client or `@tanstack/react-query` installed. So this is a
design change made before any code was written, not a migration.

We want the public API to follow a conventional, well-understood **RESTful design modeled on Stripe's
API** — versioned resource URLs, predictable HTTP verbs, a consistent list envelope, and a structured
error envelope. The motivations:

- **Familiarity & portability** — a versioned REST API (`/v1/...`) is consumable by any HTTP client,
  curl, or third party, not only a TypeScript frontend bound to tRPC.
- **Stripe's conventions are a proven template** — list envelopes, cursor pagination, `expand[]`, and a
  typed error envelope are battle-tested ergonomics.
- **Type safety is still required** — dropping tRPC means losing its direct type inference, so the design
  replaces it with an **OpenAPI 3.1 contract** generated from the same Zod schemas, plus a generated
  TypeScript client. Compile-time safety is preserved; the cost is a codegen step.

## Decision

Expose the backend as a **versioned REST API under `/v1`, modeled on Stripe (pragmatic profile)**, served
by **NestJS on the Fastify adapter** (see ADR 0004). Keep **Drizzle ORM**, **SQLite**, **Zod**, **bcrypt**,
and **JWT** from ADR 0002.

**Pragmatic Stripe profile** (what we adopt vs. skip):

- ✅ Versioned resource URLs (`/v1/subjects`, `/v1/cards`, `/v1/reviews`, …).
- ✅ Stripe **list envelope**: `{ "object": "list", "url", "has_more", "data": [...] }` with cursor
  pagination (`limit`, `starting_after`, `ending_before`). Cursors are resource `id`s, which are
  **UUIDv7** (time-sortable) so they can be used directly as cursors.
- ✅ Stripe **error envelope**: `{ "error": { "type", "code", "param?" } }` with semantic HTTP status
  codes. `error.code` carries the i18n key (e.g. `auth.emailAlreadyExists`) so the frontend-only i18n
  rule is preserved. `type` ∈ `invalid_request_error` (400/404), `authentication_error` (401),
  `api_error` (500) — no `permission_error`, since cross-user access returns 404 (don't leak existence).
- ✅ `Authorization: Bearer <JWT>` (already aligned with Stripe's Bearer scheme).
- ✅ **Conventional REST verbs**: `POST` create, `PATCH` partial update, `PUT` replace, `DELETE` — rather
  than Stripe's POST-for-everything.
- ✅ **JSON request bodies** — not Stripe's legacy `application/x-www-form-urlencoded`.
- ❌ No snake_case fields, no Unix-epoch timestamps, no prefixed IDs, no per-resource `object`
  discriminator — we keep `camelCase`, ISO 8601 timestamps, and plain UUIDv7 IDs to stay aligned with the
  TypeScript/Drizzle model. (The `object: "list"` envelope is the one exception.)
- ❌ **No `expand[]`** (dropped in ADR 0004) — a single first-party frontend joins related data from the
  TanStack Query cache; keeps response shapes (and generated types) stable.
- ❌ **No `Idempotency-Key`** (dropped in ADR 0004) — the frontend disables the submit button via
  `isPending`; TanStack Query mutations don't auto-retry, so double-`POST /v1/reviews` is prevented
  client-side.

**Type-safety chain (replaces `AppRouter` import):**

`Zod schemas (source of truth)` → `nestjs-zod` (`ZodValidationPipe` + `createZodDto`) → `@nestjs/swagger`
(patched via `patchNestjsSwagger`) emits `openapi.json` (OpenAPI 3.1) and `/docs` → frontend generates
`api/schema.d.ts` via `openapi-typescript` → typed runtime client via `openapi-fetch` →
`@tanstack/react-query` for server-state caching. The spec is committed and CI fails on drift (ADR 0004).

## Options considered

1. **Keep tRPC** (ADR 0002) — best DX for a TS-only client, zero codegen, but tightly couples the API to
   tRPC, is not a plain HTTP/REST contract, and is not the Stripe-style design requested.
2. **REST + hand-written typed SDK package** — a `packages/sdk` in the style of Stripe's official SDKs.
   Very Stripe-like, but high manual maintenance to keep in sync with the schema.
3. **REST + shared Zod + thin `apiFetch<T>()`** — lightest, no codegen, but only partial type safety and
   no OpenAPI contract.
4. **REST + OpenAPI-generated client (chosen)** — Stripe publishes an OpenAPI spec; generating types from
   it preserves compile-time safety while producing a standard, language-agnostic contract.

## Consequences

- **Standard, versioned HTTP contract** — any client can consume `/v1`; the API is documented via swagger
  UI at `/docs`.
- **Type safety preserved via codegen** — the trade-off vs. tRPC is an explicit generation step
  (`pnpm gen:api`). Zod remains the single source of truth (Zod → OpenAPI → TS types).
- **Backend structure shifts** — `routers/` → NestJS modules (controller + service per resource) plus a
  `common/` layer: a global exception filter (error envelope), a global interceptor (list envelope), and a
  `JwtAuthGuard` (replacing `protectedProcedure`; sets `request.user`). See ADR 0004. Services (SM-2, auth,
  learning) become injectable Nest providers — the logic is unchanged, only the wiring.
- **Frontend structure shifts** — `utils/trpc.ts` is removed; a new `api/` holds the generated client and
  TanStack Query wrappers. `@trpc/react-query` is replaced by `@tanstack/react-query` + `openapi-fetch`.
- **i18n rule intact** — backend returns error `code`s (i18n keys), never user-facing text.
- **Drizzle / SQLite / Zod / JWT decisions from ADR 0002 stand** — only the API/transport layer changes.

## References

- Stripe API design: https://stripe.com/docs/api
- OpenAPI 3.1: https://spec.openapis.org/oas/v3.1.0
- NestJS OpenAPI (`@nestjs/swagger`): https://docs.nestjs.com/openapi/introduction
- `nestjs-zod`: https://github.com/risen228/nestjs-zod
- `openapi-typescript` / `openapi-fetch`: https://openapi-ts.dev/
