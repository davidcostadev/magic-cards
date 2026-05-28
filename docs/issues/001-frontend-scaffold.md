# Issue 001: Frontend scaffold — Vite + TanStack Router + Tailwind + shadcn/ui + Theme + i18n + Layout shell

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: done

---

## What to build

Set up the frontend package from scratch: Vite + React + TypeScript, TanStack Router with all route definitions, Tailwind CSS with mobile-first config, shadcn/ui component library, ThemeContext (dark/light with `darkMode: 'class'`), react-i18next with `en.json`/`pt.json` translation files, and the global layout shell (Header with navigation + theme toggle + language selector, Sidebar that collapses to hamburger on mobile, 404 page).

This is the foundation that every other frontend issue builds on. After this issue, the app should be navigable — all routes exist (rendering placeholder content), the theme toggles between dark and light mode, the language switches between EN/PT, and the layout is responsive across mobile (375px) and desktop breakpoints.

Mock data shapes should mirror the database schema defined in the architecture doc (users, subjects, cards, cardProgress, reviewHistory) so components built on top can receive props that map 1:1 to future API responses.

Route structure: `/login`, `/signup`, `/dashboard`, `/subjects`, `/subjects/:id`, `/learn`, `/learn/:subjectId`, `/settings`, `/*` (404).

## Acceptance criteria

- [ ] Vite + React + TypeScript project builds and runs with `pnpm dev`
- [ ] TanStack Router configured with all routes listed above, rendering placeholder content
- [ ] Tailwind CSS configured with mobile-first breakpoints (`sm`, `md`, `lg`)
- [ ] shadcn/ui installed and at least Button, Card, Input, Dialog components available
- [ ] ThemeContext implemented — toggling switches between dark and light mode (Tailwind `dark` class on `<html>`)
- [ ] react-i18next configured with `en.json` and `pt.json` — at minimum, header and 404 page translated
- [ ] Header component with navigation links, ThemeToggle, and LanguageSelector
- [ ] Sidebar visible on `lg`+ screens, collapsed to hamburger menu on smaller screens
- [ ] 404 page rendered for unknown routes
- [ ] Layout is responsive — no horizontal overflow on 375px viewport
- [ ] Mock data type definitions created matching the database schema shapes

## Blocked by

None — can start immediately.
