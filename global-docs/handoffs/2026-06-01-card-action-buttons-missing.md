# Handoff — "New Card / Edit / Delete" buttons missing in the app

**Date:** 2026-06-01
**Next session focus (user):** *"precisamos resolver isso na próxima. Eu noto que os botões de adicionar
cards, editar e delete sumiram no app."* → The **New Card**, **Edit**, and **Delete** buttons disappeared
in the running app. Reproduce, diagnose, fix.

---

## TL;DR of the bug to fix

All three controls (add-card + per-card edit/delete) vanished. They are **all gated by the same flag**, so
they disappear together — the question is *why the flag is on (or the buttons are hidden)*. Investigate the
two ranked hypotheses below, confirm against a subject the user **owns** vs a **public/catalog** one, then
fix.

### Where the gating lives
- `packages/frontend/src/pages/SubjectDetailPage.tsx`
  - `const isPublic = subject.isPublic;`
  - **New Card** button is rendered only `{!isPublic && ( … )}`
  - `<CardList … readOnly={isPublic} … />`
- `packages/frontend/src/components/features/cards/CardList.tsx`
  - Edit/Delete are rendered only `{!readOnly && ( … )}`, and that block is
    `opacity-100 … sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`
    (i.e. **hidden until hover/focus on ≥sm screens**).

### Hypotheses (ranked)
1. **Most likely — viewing a PUBLIC (catalog) subject, which is read-only by design.** This session imported
   a lot of public content (see "Current state"), so the user is probably on a catalog subject where
   `isPublic === true` → New Card hidden + CardList `readOnly` → edit/delete hidden. **Verify:** is the
   subject they're on owned by them or public? On their *own* subject the buttons should still appear.
   - If confirmed: decide the intended UX — public/catalog content **cannot** be edited by a user (only via
     `x-api-key` catalog endpoints). Options: make the read-only state explicit in the UI (e.g. a "Shared
     content" banner — the `subjects.sharedReadOnly` i18n key already exists), and/or ensure the user has an
     obvious path to their *own* subjects.
2. **Desktop hover-reveal** — Edit/Delete are `opacity-0` on ≥sm until you hover the card row (pre-existing
   behavior). They can *look* gone. **Verify:** hover a card; do they fade in? If this is the complaint,
   consider making them always visible (or more discoverable) on desktop.

### Likely NOT the cause (but worth a 2-min diff check)
- The button-gating logic was **not changed** this session. The interactive-card-types work (commit
  `351a604`, already pushed) added a *type badge* to `CardList` and tweaked `handleSave` in
  `SubjectDetailPage`, but left the `!isPublic` / `!readOnly` conditions intact. Diff those two files to be
  sure nothing rendering-related regressed.

### How to reproduce / verify
Use the **`verify`** or **`run`** skill to launch the app and observe. A backend is already up on `:3001`
(see below). Create/own a subject and compare its detail page to a catalog subject (e.g. "Linux & Bash",
which is public → expected to have no buttons).

---

## Current state of the repo & environment

- **Branch `main`, 5 unpushed commits** (the user has **not** authorized a push yet):
  `dbc8e9d` (CORS fix + E2E), `a17cf7a` (seed dataset — later removed), `51249b2` (remove seed tooling),
  `76f9705` (catalog import/export), `54410bd` (authoring docs). All green: lint, type-check,
  113 backend + 10 frontend unit tests, 9/9 Playwright E2E.
- **A backend dev server is running on `:3001`** (pid was 66268, a pre-existing `nest start --watch`, *not*
  started cleanly by this session — an earlier attempt crashed with `EADDRINUSE`). Its `CONTENT_API_KEY`
  comes from `packages/backend/.env`. Treat it as possibly belonging to another session; don't kill it
  blindly.
- **Dev DB** (`packages/backend/data/pg`, gitignored PGlite, **persists** across restarts) currently holds
  **public catalog content**: the old 77-card dataset (from a one-off seed run that was since removed),
  plus `example-ts` (4 cards) and `linux-cli` "Linux & Bash" (12 cards) imported via the new API. These are
  all `isPublic` subjects → read-only in the UI (relevant to hypothesis #1).
- **Global heavy-op lock** was installed at `~/.claude` this session (hooks serialize docker/e2e/integration
  to one at a time). It activates in **new** sessions. See `~/.claude/hooks/README.md` and the memory
  `global-heavy-op-lock`. If a heavy command is blocked, inspect/unlock with
  `python3 ~/.claude/hooks/heavy_op_lock.py status|unlock`.

## What was built this session (reference only — don't redo)

Don't re-explain these; read the artifacts:
- Interactive card types (quiz/type-answer/match), server-graded — commit `351a604`; docs in
  `docs/architecture.md` §4/§6, `CONTEXT.md`, and the prior handoff
  `global-docs/handoffs/2026-06-01-alternative-card-types.md`.
- CORS fix for PATCH/PUT/DELETE + E2E specs — commit `dbc8e9d` (`packages/backend/src/app.factory.ts`,
  `e2e/specs/*`).
- Catalog bulk **import/export** API + the **Content Authoring Guide** — commits `76f9705`, `54410bd`;
  docs `docs/content-authoring.md` and `docs/content-catalog.md` §4b; example
  `docs/examples/catalog-import.example.json`. The one-off seed was removed (`51249b2`).

## Open follow-ups (lower priority than the button bug)
- Push the 5 commits when the user authorizes.
- Optional future work the user floated: a card **search** endpoint (`GET /v1/catalog/cards?q=&tag=`) and an
  **MCP server** wrapping the catalog API — explicitly deferred ("não vamos construir ainda").

## Suggested skills
- **`verify`** (or **`run`**) — launch the app and reproduce the missing buttons; confirm whether the
  affected subject is public vs owned, and whether edit/delete appear on hover.
- **`code-review`** — once a fix is drafted, review the diff (this touches read-only/visibility logic that
  also guards against editing shared content — get it right).
