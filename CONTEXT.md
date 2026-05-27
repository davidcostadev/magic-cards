# Magic Cards — Domain Glossary

> This file defines the canonical language of the Magic Cards domain.
> No implementation details — only terms, their meanings, and their relationships.

---

## Card

A learning unit consisting of a **question** and an **answer**, both in Markdown format (with syntax highlighting support for code blocks). Cards belong to exactly one Subject.

A Card has no static difficulty classification. Difficulty is an emergent property discovered by the SM-2 algorithm through the learner's actual performance (see Card Progress / ease factor).

A Card may have zero or more **Hints** — ordered textual clues that help the learner recall the answer without revealing it entirely.

## Hint

An ordered textual clue attached to a Card. Hints are revealed one at a time during a Review. Using any Hint during a Review **caps the maximum Quality at 3**, meaning the Card will be scheduled for earlier re-review regardless of how confident the learner felt.

## Subject

A user-defined grouping of related Cards (e.g., "TypeScript Fundamentals", "SQL Joins"). Every Subject belongs to exactly one User.

A Subject does not store a card count. The number of Cards in a Subject is always computed on demand — never cached or denormalized.

## Review

A single evaluation event following this interaction sequence:

1. The Card's **question** is displayed (rendered Markdown).
2. The learner may optionally reveal **Hints** one at a time — they appear inline, sequentially, with a fade-in animation. Revealing any hint marks the review as hint-assisted.
3. The learner clicks **"Reveal answer"**.
4. The **answer** appears below the question with a slide/fade animation (no card flip — Markdown content with code blocks has variable height that makes flip animations impractical).
5. The learner rates their performance via the two-step hybrid flow:

1. **Outcome**: the learner declares "Wrong" or "Right".
2. **Confidence** (only if Right): the learner chooses "Hard", "Good", or "Easy".

This maps to a **Quality** score:

| Outcome | Confidence | Quality |
|---------|------------|---------|
| Wrong   | —          | 1       |
| Right   | Hard       | 3       |
| Right   | Good       | 4       |
| Right   | Easy       | 5       |

If any Hint was used, Quality is capped at 3 regardless of the learner's self-assessment.

## Quality

An integer (1–5 in practice) representing how well the learner recalled the answer during a Review. Drives the SM-2 scheduling algorithm. Quality 0 and 2 are not reachable through the UI.

## Card Progress

The current spaced-repetition state for a specific User–Card pair. Tracks interval, ease factor, repetition count, and next review date. Updated after every Review.

## Card Status

The lifecycle stage of a Card Progress:

- **New** — never reviewed.
- **Learning** — early reviews (1–3 repetitions, interval < 7 days).
- **Reviewing** — established review cycle with stable intervals.
- **Mastered** — interval > 21 days with high ease factor.

## Learning Session

A bounded sequence of Reviews that the learner initiates on demand.

**Scope**: the learner chooses either a specific Subject or "Review all" (mixed subjects).

**Card selection order**:
1. Overdue cards first, ordered by staleness (most overdue first).
2. New cards to fill remaining capacity — capped at **30 %** of the session's total cards to avoid overwhelming the learner.

**Daily Goal**: a user-configurable target (default: 20 reviews/day). Displayed as a progress bar but **not a hard limit** — the learner may continue past the goal.

**Termination**: the session ends when no more eligible cards remain OR the learner chooses to stop.

## Review History

An immutable log entry recording the outcome of a single Review: quality, time spent, whether hints were used, and when it happened. Used for analytics, never mutated.

## Procedure (tRPC)

A typed function exposed by the backend that the frontend can call directly with full TypeScript inference. Replaces REST endpoints. Procedures are organized into tRPC routers grouped by domain (auth, subjects, cards, learning). Input is validated with Zod schemas.

## Router

The presentation layer in tRPC. A router groups related Procedures, validates input via Zod, and delegates to Services (when business logic exists) or to Drizzle directly (for simple CRUD). Routers contain no business logic.

## Service

A plain TypeScript module containing business logic that is independent of tRPC. Services exist only when there is real logic to encapsulate (SM-2 algorithm, card selection, auth). Simple CRUD does not warrant a service — the router calls Drizzle directly.

## Monorepo

The project is organized as a pnpm workspace monorepo. The frontend imports the `AppRouter` type from the backend package for end-to-end type inference — no manual API types, no codegen.

## Internationalization (i18n)

Translation lives exclusively in the frontend (`react-i18next`). The backend never returns user-facing text — it returns error codes/keys (e.g., `"auth.emailAlreadyExists"`), and the frontend maps them to the active language. Supported languages: English and Portuguese. Single source of truth for all translations.

## Frontend State Strategy

- **Server state** (cards, subjects, sessions, stats) is managed exclusively by TanStack Query via `@trpc/react-query`. No manual fetching hooks or contexts for server data.
- **Client state** uses React Context for two concerns only: **AuthContext** (JWT token + current user) and **ThemeContext** (dark/light mode).
- **Language** is managed by `react-i18next` directly — no custom LanguageContext.

## API Response Convention

No wrapper envelope. tRPC handles serialization and error propagation automatically. Errors surface as typed TRPCError instances with standard HTTP status codes.

## Dashboard

A read-only view showing the learner's progress. Metrics displayed:

- **Cards reviewed today** — progress towards the Daily Goal.
- **Streak** — consecutive days where the Daily Goal was met. Resets on a missed day.
- **Accuracy rate** — percentage of Reviews with Quality >= 3, over the last 7 and 30 days.
- **Cards by status** — count of New / Learning / Reviewing / Mastered cards, per Subject and total.
- **Weak cards** — cards with the lowest ease factor or highest recent failure rate.
- **Upcoming reviews** — cards due today, tomorrow, and this week.

No temporal evolution charts or user-vs-user comparisons.
