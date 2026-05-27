# Handoff: Frontend UI Prototype Implementation

**Date**: 2026-05-27
**Context**: Magic Cards — spaced repetition learning platform for programming/tech education

---

## What happened in this session

1. **Created 6 FRDs** in `docs/frd/` covering all implementation phases. Key decision: **Phase 0 is UI-only** — build all screens with mock data first, validate visually, then proceed to backend.
2. **Created 7 frontend issues** in `docs/issues/` as vertical slices of FRD-001 (UI Prototype).
3. **Committed** everything: `a3a44ba`.

## What the next session should do

**Implement the 7 frontend issues in dependency order.** Start with Issue 001 (scaffold), then the rest can be parallelized.

### Issue order (dependency graph)

```
001 (scaffold) ← START HERE
 ├── 002 (auth pages)
 ├── 003 (subjects) → 004 (cards)
 ├── 005 (review flow)  ← densest issue, core product
 ├── 006 (dashboard)
 └── 007 (settings)
```

### Key artifacts to read

| Artifact | Path | Purpose |
|----------|------|---------|
| Domain glossary | `CONTEXT.md` | Canonical terms (Card, Subject, Review, Quality, etc.) |
| Architecture | `docs/architecture.md` | Schema shapes, component tree, tech stack details |
| ADRs | `docs/adr/` | SQLite decision, Fastify+tRPC decision |
| FRD-001 | `docs/frd/FRD-001-ui-prototype.md` | Full spec for the UI prototype phase |
| Issues | `docs/issues/001-*.md` through `007-*.md` | Individual acceptance criteria per slice |
| Dev guidelines | `CLAUDE.md` | Commands, conventions, commit format |

### Critical implementation notes

- **No backend** — all data comes from mock objects. Do NOT use TanStack Query or tRPC client yet. Local state and props only.
- **Mock data shapes must match the DB schema** defined in `docs/architecture.md` section 4 (users, subjects, cards, cardProgress, reviewHistory) so future backend integration is a clean swap.
- **No tests** — visual validation only for this phase.
- **No Co-Authored-By** in commit messages (project convention in CLAUDE.md).
- **Tech stack**: Vite + React + TypeScript, TanStack Router, Tailwind CSS + shadcn/ui, react-i18next, react-markdown with syntax highlighting.
- **Mobile-first**: Default styles target mobile (375px). Responsive up via `sm`/`md`/`lg` breakpoints.
- **Issue 005 (review flow)** is the most important — it's the core product interaction. Markdown rendering with syntax highlighting + animations for hint reveal and answer reveal.
- **Commit convention**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

### What NOT to do

- Don't build backend, tRPC, Drizzle, or SQLite — that's FRD-002.
- Don't add Zod validation — forms are visual only.
- Don't add automated tests — that's FRD-006.
- Don't add a `packages/backend/` directory yet.

## Suggested skills

- `/run` — after implementing Issue 001, use this to launch the Vite dev server and verify the scaffold works.
- `/verify` — use after each issue to confirm the UI renders correctly in the browser.
- `/code-review` — optional, run after completing all 7 issues to catch quality issues before moving to FRD-002.
- `/simplify` — if the diff grows large, use to clean up before committing.
