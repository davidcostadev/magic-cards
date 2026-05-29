# Handoff — Magic Cards UI: onboarding, a11y, content expansion

**Date:** 2026-05-29
**Branch:** `main` (commits made directly here per project convention; not pushed)
**Scope:** Frontend only (`packages/frontend`). The app currently runs on **mock data** (no backend wired yet).

## What this session delivered

Three commits on top of `593ff31`:

- `8239eb8` — card language moved to Settings, subject search, card/button refinements
- `2e602db` — onboarding + preferences persistence + subject selection + mocks→JSON + UI/a11y overhaul + bootstrap-style buttons + mobile `dvh`
- `b5e065a` — content expansion (10 subjects / 45 cards) + onboarding presets first 4 / requires ≥1 + centralized subject icon map

See `git show <hash>` for diffs — not duplicated here.

## Current state / key architecture introduced this session

- **`src/context/PreferencesContext.tsx`** — `onboarded` flag + `selectedSubjectIds` (active subjects), persisted to `localStorage`. Exposes `completeOnboarding`, `toggleSubject`, `isSubjectActive`, `setSelectedSubjectIds`. Also exports `isOnboarded()` for use in the router guard (reads localStorage directly).
- **Onboarding** — `src/pages/OnboardingPage.tsx`, 2 steps (prefs → subjects). Route `/onboarding` with gate in `src/router.tsx`: `requireAuth` now also redirects to `/onboarding` when authed-but-not-onboarded; `requireOnboardingPending` bounces already-onboarded users to `/dashboard`. `AppLayout` (`src/App.tsx`) renders onboarding full-screen without Header/nav.
- **Mock content moved to JSON** — `src/mocks/content.json` holds `subjects` + `cards`. `src/mocks/data.ts` imports it (`resolveJsonModule` enabled in tsconfig) and still defines `mockUser`, `mockCardProgress`, `mockReviewHistory` inline. To edit/expand content, edit the JSON. (It was generated via a throwaway Node script; there is no committed generator.)
- **Subject icons centralized** — `src/components/features/subjects/subjectIcons.ts` (`getSubjectIcon`). The four previously-duplicated local maps were removed.
- **Subject selection/filtering** — Subjects page shows only active subjects + "Manage" modal (`ManageSubjectsModal`) to add/remove; `/learn` ("all") respects the selection. Per-subject "Study" button on each card.
- **Persistence** — language (i18next), theme (ThemeContext), `cardLanguage` (AuthContext) all in localStorage.

## Cross-cutting conventions established (important — keep following)

- **Global rule added to `~/.claude/CLAUDE.md`**: every clickable/focusable element must have `cursor-pointer`, `:hover`/`:active`/`:focus-visible`, keyboard reachability, and inputs need hover + `aria-invalid` error + disabled states. Applies to all projects.
- **Prefer solid colors over `/10`-style opacity in buttons** (user preference this session).
- **Tailwind v4 gotcha**: v4 Preflight does NOT set `cursor: pointer` on `<button>` — must add `cursor-pointer` explicitly (done in the shared `Button`).
- **Theme gotcha (fixed)**: `--color-accent` was identical to `--color-secondary`, so `hover:bg-accent` was invisible. `accent` is now a distinct shade in `globals.css`.
- **Header buttons** use the new `outlinePrimary` Button variant (purple outline, fills on hover).
- **Mobile viewport**: use `dvh` (not `vh`/`min-h-screen`) for full-height/full-screen surfaces so bottom buttons clear Android browser/nav bars. Modals (`Dialog`) are full-screen on mobile, centered card on desktop.

## Possible next steps (not started)

- **Anki-like content management** — user wants, beyond the current active/inactive filter, a richer "add/remove decks" experience later.
- **Dashboard** is NOT filtered by active subjects (still uses all `mockCardProgress`); new cards have no progress entries. Decide whether dashboard should respect the selection.
- **Settings → Card Language still shows "All"** (intentionally kept as a study filter; user only removed "All" from onboarding). Confirm if it should stay.
- **No tests added** this session. `pnpm test` (Vitest) exists; coverage target is 80%+. New logic (PreferencesContext, onboarding gate, subject filtering) is untested.
- **Backend/tRPC** not touched — everything is mock/localStorage. Real persistence is future work.

## Verify before continuing

- `pnpm type:check` and `pnpm build` both pass as of `b5e065a`. (Note: the `lint` script is just `tsc`; Biome is referenced in docs but not installed.)
- Manual: not visually verified this session — the user reviews in their own browser (they mentioned `localhost:5000`).

## Suggested skills

- **verify** / **run** — launch the app and visually confirm onboarding flow, mobile full-screen modals, focus rings, and the new subjects/cards render correctly.
- **code-review** — review the accumulated diff (3 commits) for correctness before any push.
- **to-issues** — if the "Anki-like content management" idea is to be pursued, break it into tracer-bullet issues.
