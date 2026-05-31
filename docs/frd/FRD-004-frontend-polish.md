# FRD-004: Frontend Polish

**Status**: Ready for Implementation
**Phase**: 3 — Polish
**Date**: 2026-05-27
**Depends on**: FRD-003 (Core learning functional)

---

## Problem Statement

The core learning loop is functional, but the experience needs refinement. Markdown rendering quality, review animations, responsive edge cases, and i18n completeness need to be polished for a Duolingo-like user experience.

## Solution

Refine the Markdown rendering pipeline, perfect the review flow animations, ensure full responsive coverage across breakpoints, complete i18n for all user-facing strings, and polish the theme implementation.

## User Stories

1. As a learner, I want code blocks in card questions and answers to have syntax highlighting for common languages (TypeScript, JavaScript, Python, SQL, HTML, CSS), so that technical content is easy to read.
2. As a learner, I want inline code, bold, italic, lists, and links rendered correctly in card content, so that rich Markdown is fully supported.
3. As a learner, I want the answer to appear with a smooth slide/fade animation when I click "Reveal answer", so that the transition feels polished.
4. As a learner, I want hints to appear one at a time with a fade-in animation, so that the progressive reveal feels natural.
5. As a learner, I want the app to feel native on mobile (375px–428px viewport), with touch-friendly buttons and appropriate spacing, so that I can study on my phone.
6. As a learner, I want the sidebar to collapse into a hamburger menu on mobile, so that screen space is maximized for content.
7. As a learner, I want all UI text in English and Portuguese, so that I can use the app in my preferred language.
8. As a learner, I want error messages from the backend displayed in my chosen language, so that errors are understandable.
9. As a learner, I want dark mode to look polished (proper contrast, no unstyled elements), so that I can study comfortably in low light.
10. As a learner, I want my theme preference persisted across sessions, so that I don't have to toggle it every time.
11. As a learner, I want my language preference persisted across sessions, so that the app remembers my choice.
12. As a learner, I want loading states and skeleton screens while data is being fetched, so that the app doesn't feel broken during network requests.
13. As a learner, I want empty states (no subjects yet, no cards in subject, no reviews today) with helpful messages, so that I know what to do next.
14. As a learner, I want form validation feedback on auth and card forms, so that I know when my input is invalid.

## Implementation Decisions

- **Markdown rendering**: react-markdown with rehype-highlight (or shiki for more advanced theming). Code blocks should respect the current theme (dark/light syntax theme). Sanitize HTML output to prevent XSS.
- **Animations**: CSS transitions preferred over JS animation libraries. Answer reveal uses `max-height` + `opacity` transition. Hint fade-in uses `opacity` + `translate-y` transition. Keep animations under 300ms for responsiveness.
- **Responsive breakpoints**: Follow Tailwind defaults — `sm` (640px), `md` (768px), `lg` (1024px). Test at 375px (iPhone SE), 428px (iPhone 14 Pro Max), 768px (iPad), 1024px+.
- **Sidebar**: Visible on `lg`+, collapsed to hamburger menu below `lg`. Sheet/drawer pattern on mobile (shadcn/ui Sheet component).
- **i18n completeness**: Every user-facing string must go through `t()`. This includes button labels, placeholders, tooltips, error messages, empty states, and loading text. Backend error codes mapped in both `en.json` and `pt.json`.
- **Theme persistence**: ThemeContext reads initial value from `localStorage` (or user preference from backend). Tailwind `darkMode: 'class'` — ThemeContext toggles `dark` class on `<html>`.
- **Loading states**: TanStack Query's `isLoading` / `isPending` states used to show skeleton loaders (shadcn/ui Skeleton component) on lists and cards.
- **Empty states**: Each list view (subjects, cards, reviews) has a dedicated empty state with illustration/icon and call-to-action.
- **Form validation**: Zod schemas on REST endpoints already validate server-side. Frontend should show inline validation errors read from the Stripe-style error envelope (`error.code` → i18n message, `error.param` → field). Optionally add client-side validation with the same Zod schemas for instant feedback.

## Testing Decisions

No tests in this phase. Visual QA across viewports and themes is the acceptance criterion.

## Out of Scope

- New features or endpoints — this phase only polishes existing functionality
- Dashboard stats (FRD-005)
- Performance optimization
- Automated visual regression tests

## Further Notes

- The Duolingo-inspired feel comes from micro-interactions: smooth animations, satisfying button feedback, progress visualization. Pay attention to transition timing and easing curves.
- Markdown sanitization is a security requirement — use rehype-sanitize or equivalent to prevent XSS from user-authored card content.
- i18n should cover error paths too — a Portuguese-speaking user seeing an English error message breaks the experience.
