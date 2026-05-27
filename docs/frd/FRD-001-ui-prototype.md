# FRD-001: UI Prototype

**Status**: Ready for Implementation
**Phase**: 0 — Visual Validation
**Date**: 2026-05-27

---

## Problem Statement

Before investing in backend logic, database schema, and business rules, the team needs to validate the product's look and feel. Building all screens with mock data first allows visual validation and early course correction — adjusting requirements, layouts, and flows before they're coupled to a real backend.

## Solution

Build every frontend page and component using static/mock data, fully styled with Tailwind CSS + shadcn/ui. The app should be navigable end-to-end (TanStack Router), responsive (mobile-first), and visually complete — but with no real backend calls. All server state comes from hardcoded mock objects or local state.

## User Stories

1. As a learner, I want to see a login page with email/password fields and a link to sign up, so that I understand how authentication will work.
2. As a learner, I want to see a signup page with email, password, and username fields, so that I can evaluate the onboarding flow.
3. As a learner, I want to see a dashboard after logging in with cards reviewed today, streak count, accuracy rate, cards by status, weak cards, and upcoming reviews, so that I can validate the information hierarchy.
4. As a learner, I want to see a subjects list page showing subject cards with title, description, color, icon, and computed card count, so that I can evaluate the subject organization UI.
5. As a learner, I want to see a create/edit subject modal with title, description, color picker, and icon selector fields, so that I can validate the subject management flow.
6. As a learner, I want to see a subject detail page listing all cards within a subject, so that I can evaluate card browsing.
7. As a learner, I want to see a card creation/edit form with question (Markdown), answer (Markdown), hints (ordered list), and tags fields, so that I can validate the card authoring experience.
8. As a learner, I want to see the full review flow: question displayed → optional hint reveal (one at a time, fade-in) → "Reveal answer" button → answer slides in below → two-step quality rating (Wrong/Right, then Hard/Good/Easy), so that I can validate the core learning interaction.
9. As a learner, I want to see a session summary screen at the end of a review session showing cards reviewed, accuracy, and time spent, so that I can evaluate the post-session experience.
10. As a learner, I want to see a daily goal progress bar on the dashboard, so that I can validate how motivation tracking feels.
11. As a learner, I want to see a streak widget showing consecutive days of meeting the daily goal, so that I can evaluate the gamification element.
12. As a learner, I want to see a weak cards widget listing cards with low ease factor, so that I can evaluate how struggling cards are surfaced.
13. As a learner, I want to see an upcoming reviews widget showing counts for today, tomorrow, and this week, so that I can evaluate the review forecast.
14. As a learner, I want to see a settings page where I can change language (EN/PT), theme (dark/light), and daily goal, so that I can validate the personalization options.
15. As a learner, I want to see a header with navigation, theme toggle, and language selector, so that I can evaluate the global navigation pattern.
16. As a learner, I want to see the app in dark mode and light mode, so that I can validate both visual themes.
17. As a learner, I want to see the app on mobile viewport (375px) and desktop, so that I can validate responsive behavior.
18. As a learner, I want to see a 404 page when navigating to an unknown route, so that I can evaluate error handling UX.
19. As a learner, I want to see Markdown-rendered content with syntax-highlighted code blocks in the card question and answer areas, so that I can validate the reading experience for technical content.
20. As a learner, I want to see hint text appear inline and sequentially with a fade-in animation when I click to reveal each hint, so that I can evaluate the hint interaction pattern.
21. As a learner, I want the answer to appear below the question with a slide/fade animation (not a card flip), so that I can evaluate the reveal experience for variable-height Markdown content.
22. As a learner, I want to see i18n working with at least login/signup and dashboard in both English and Portuguese, so that I can validate the translation structure.

## Implementation Decisions

- **No backend calls**: All data comes from hardcoded mock objects defined in a `mocks/` directory or co-located with components. TanStack Query hooks should NOT be used yet — this phase uses local state and props only.
- **TanStack Router**: Route structure must be set up from the start so navigation is real. Routes: `/login`, `/signup`, `/dashboard`, `/subjects`, `/subjects/:id`, `/learn`, `/learn/:subjectId`, `/settings`, `/*` (404).
- **shadcn/ui components**: Use Button, Card, Input, Dialog, Badge, Progress, Tabs, DropdownMenu, and other primitives from shadcn/ui. Install and configure the component library in this phase.
- **Tailwind CSS**: Mobile-first responsive design. Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px). Default styles target mobile.
- **Theme**: ThemeContext with dark/light mode. Tailwind `darkMode: 'class'` strategy. Theme toggle in header.
- **i18n**: react-i18next configured with `en.json` and `pt.json`. At minimum, auth pages and dashboard translated. Language selector in header.
- **Markdown rendering**: react-markdown with rehype-highlight or shiki for syntax highlighting. Used in CardReview for question and answer display.
- **Animations**: CSS transitions or Tailwind `animate-*` classes for hint fade-in and answer slide/reveal. No heavy animation library needed.
- **Mock data structure**: Mocks should mirror the exact shape defined in the database schema (architecture.md section 4) so they can be swapped for real API responses later without changing component props.
- **Component organization**: Follow the project structure defined in architecture.md section 3 — `components/common/`, `components/features/`, `components/ui/`, `pages/`.
- **AuthContext**: Implement with mock user data (simulated login always succeeds). This validates the context structure and protected route pattern.
- **No form validation logic**: Forms should have visual structure but don't need Zod validation or real error handling yet.

## Testing Decisions

No tests in this phase. Visual validation by the developer is the acceptance criterion.

## Out of Scope

- Real backend (Fastify, tRPC, Drizzle, SQLite)
- Real authentication (JWT, bcrypt)
- SM-2 algorithm logic
- Real card selection / learning session logic
- Database schema and migrations
- Form validation with Zod
- Automated tests (unit, integration, E2E)
- Deployment and CI/CD

## Further Notes

- This phase is explicitly a **validation gate**. After completing the UI, the developer will review all screens and decide whether to proceed with the current design or adjust requirements before building the backend.
- Mock data should include realistic programming/tech content (e.g., TypeScript questions, SQL examples) to evaluate the Markdown rendering quality.
- The review flow (CardReview → HintReveal → AnswerReveal → QualityButtons → SessionSummary) is the highest-priority UI to get right — it's the core product interaction.
