# FRD-005: Dashboard & Analytics

**Status**: Ready for Implementation
**Phase**: 4 — Analytics
**Date**: 2026-05-27
**Depends on**: FRD-003 (Core learning with review history)

---

## Problem Statement

The learner is studying with spaced repetition, but has no visibility into their progress beyond the session summary. They need a dashboard showing how they're doing over time — streaks, accuracy, weak areas, and upcoming workload — to stay motivated and identify where to focus.

## Solution

Implement backend stats endpoints (`/v1/dashboard/*`) and connect them to the existing dashboard UI components. All metrics are computed from the review history and card progress tables — no new tables or denormalized counters.

## User Stories

1. As a learner, I want to see how many cards I've reviewed today vs. my daily goal, so that I know how close I am to my target.
2. As a learner, I want to see my current streak (consecutive days meeting the daily goal), so that I'm motivated to maintain it.
3. As a learner, I want my streak to reset if I miss a day, so that the metric is honest.
4. As a learner, I want to see my accuracy rate over the last 7 days and 30 days, so that I can track whether I'm improving.
5. As a learner, I want accuracy defined as the percentage of reviews with quality >= 3, so that the metric reflects meaningful recall.
6. As a learner, I want to see a breakdown of my cards by status (New / Learning / Reviewing / Mastered), so that I understand my overall progress.
7. As a learner, I want the status breakdown per subject and as a total, so that I can compare subjects.
8. As a learner, I want to see my weakest cards (lowest ease factor or highest recent failure rate), so that I know which topics need more attention.
9. As a learner, I want to see how many reviews are due today, tomorrow, and this week, so that I can plan my study time.
10. As a learner, I want the dashboard to load quickly, so that I can check my progress without waiting.
11. As a learner, I want all dashboard metrics in my chosen language, so that numbers, labels, and relative dates are localized.

## Implementation Decisions

- **`GET /v1/dashboard/stats` endpoint**: Accepts `?period=7d|30d`. Returns:
  - `reviewedToday`: COUNT of reviewHistory where `reviewedAt` is today and `userId` matches.
  - `dailyGoal`: From user preferences.
  - `streak`: Count consecutive past days (from yesterday backwards) where daily review count >= dailyGoal. Today counts toward streak only if goal is already met.
  - `accuracy`: Percentage of reviews with `quality >= 3` within the requested period.
  - `cardsByStatus`: Group cardProgress by status, count per group. Include per-subject breakdown.
- **`GET /v1/dashboard/weak_cards` endpoint**: Returns a list envelope of cards ordered by lowest `easeFactor` (ascending), with a secondary sort by most recent failure (quality < 3). Default `limit`: 10. Returns card data joined with cardProgress and subject info (no `expand[]` — the subject fields needed are included directly).
- **`GET /v1/dashboard/upcoming` endpoint**: Returns `{ today, tomorrow, thisWeek }` — counts of cardProgress rows where `nextReviewDate` falls within each window.
- **Streak calculation**: Query reviewHistory grouped by date (UTC), count per day, check against dailyGoal. Iterate backwards from yesterday until a day fails the threshold. Pure SQL aggregation, no stored streak counter.
- **No temporal charts**: As defined in CONTEXT.md, the dashboard shows point-in-time metrics only — no line charts, no historical trends, no user comparisons.
- **Frontend**: Connect Dashboard, StatsCard, StreakWidget, WeakCardsWidget, UpcomingReviews components to the real `/v1/dashboard/*` endpoints via the generated client. Replace mock data. Use TanStack Query with appropriate `staleTime` (stats can be stale for ~60s).
- **Caching strategy**: Dashboard stats are read-heavy and can tolerate brief staleness. Use `staleTime: 60_000` for stats queries. Invalidate on review submission.

## Testing Decisions

**TDD (ADR 0005).** The metrics are pure aggregation logic — ideal for test-first:
- **Unit/Integration** (Vitest + `@nestjs/testing`, real SQLite seeded with known reviewHistory): the
  **streak** query (the trickiest — consecutive days vs. daily goal, UTC grouping, edge cases: user
  created today, goal met today but not yesterday), `accuracy` (% quality ≥ 3 over 7d/30d),
  `cardsByStatus`, `weak_cards` ordering, and `upcoming` windows. Each metric gets a failing test against a
  fixed dataset before implementation.
- **E2E** (Playwright): the dashboard reflects a freshly completed review (reviewed-today count + streak).

## Out of Scope

- Historical trend charts or graphs
- User-vs-user comparisons or leaderboards
- Export of analytics data
- Notification system for streak at risk

## Further Notes

- Streak calculation is the most complex query in this phase. It requires grouping reviews by day (UTC), comparing against the user's daily goal, and counting consecutive passing days. Consider edge cases: user created today (streak = 0), user met goal today but not yesterday (streak = 0 or 1 depending on convention — we define streak as consecutive days including today if met).
- Weak cards identification helps the learner study strategically. Surfacing the 10 weakest cards provides actionable insight without overwhelming with data.
- All dashboard metrics are derived from existing tables (reviewHistory, cardProgress, users). No new schema changes needed.
