# Security Audit (FRD-006)

**Date:** 2026-05-31
**Scope:** OWASP Top 10 relevant to this stack — injection, XSS, broken auth, broken
access control — plus the FRD-006 §41 checklist.

| # | Control | Status | Evidence |
|---|---------|--------|----------|
| 1 | JWT secret strong & from env | ✅ | `auth.service.ts` reads `process.env.JWT_SECRET`; `main.ts` refuses to boot in production without it. `.env.example` documents it. |
| 2 | Passwords hashed (bcrypt, 10 rounds) | ✅ | `auth.service.ts` `hashPassword`/`verifyPassword` (bcryptjs, `BCRYPT_ROUNDS = 10`). Hash never returned (`toUserResponse` strips it). |
| 3 | All inputs validated (Zod) | ✅ | Global `ZodValidationPipe` (`app.module.ts`); every endpoint body/query is a `createZodDto` schema. Invalid input → `400 errors.validation` with `param`. |
| 4 | Markdown output sanitized (XSS) | ✅ | `MarkdownContent.tsx` uses `react-markdown` with **safe defaults** — raw HTML is not rendered (no `rehype-raw`/`dangerouslySetInnerHTML`) and link URLs are sanitized. `rehype-highlight` only adds class names. |
| 5 | Broken access control — userId filtering | ✅ | Every query filters by `request.user.id` (set by `JwtAuthGuard`). Cross-user access returns **404** (not 403) so existence isn't leaked. Covered by integration tests (`*.controller.spec.ts`). |
| 6 | CORS restricted to frontend origin | ✅ | `app.factory.ts` `enableCors` reads `CORS_ORIGIN` (no wildcard). |
| 7 | Rate limiting on auth | ✅ | `@nestjs/throttler`: global 300/min + `@Throttle` 20/min on `signup`/`login`. `429 errors.rateLimited`. |
| 8 | Auth on all non-public routes | ✅ | Global `JwtAuthGuard`; only `signup`/`login` opt out via `@Public()`. Missing/invalid token → `401`. |
| 9 | SQL injection | ✅ | Drizzle parameterised queries throughout; no string-built SQL. |
| 10 | Secrets not committed | ✅ | `.env` git-ignored; only `.env.example` committed. |
| 11 | Catalog API key (shared content) | ✅ | `POST /v1/catalog/*` is gated by `ApiKeyGuard` (constant-time `x-api-key` compare against `CONTENT_API_KEY`); disabled when the key is unset. Publish-only scope; grants no user-data access. Public content is read-only to users (mutations stay owner-only). See ADR 0007. |

## Notes & residual risks

- **JWT secret default**: outside production the app falls back to a dev secret for
  convenience; production boot now hard-fails without `JWT_SECRET` (`main.ts`).
- **Rate limiting is per-IP, in-memory**: sufficient for a single instance. Behind a
  shared proxy / multi-instance deploy, move to a shared store (e.g. Redis) and trust
  `X-Forwarded-For`.
- **No token revocation**: JWTs are stateless with a 24h expiry and no refresh — a
  deliberate scope decision (architecture §8). Logout is client-side only.
- **Tokens in `localStorage`**: convenient and standard for this SPA; acceptable given
  the XSS surface is minimal (sanitized Markdown, no `dangerouslySetInnerHTML`).
