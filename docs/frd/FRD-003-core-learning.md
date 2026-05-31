# FRD-003: Core Learning

**Status**: Ready for Implementation
**Phase**: 2 — Core Learning
**Date**: 2026-05-27
**Depends on**: FRD-002 (Backend foundation complete)

---

## Problem Statement

The UI prototype and auth foundation are in place. The learner now needs the core product loop: creating subjects and cards, and reviewing them with spaced repetition scheduling. This is the phase where the mock data in subjects, cards, and learning pages gets replaced with real backend logic.

## Solution

Implement subject CRUD, card CRUD, the SM-2 spaced repetition algorithm, learning session card selection, and the review flow — connecting the existing UI components to real REST endpoints (`/v1`) backed by SQLite.

## User Stories

### Subjects

1. As a learner, I want to create a subject with title, description, color, and icon, so that I can organize my learning materials.
2. As a learner, I want to see a list of my subjects with computed card count, so that I can browse my subjects.
3. As a learner, I want to edit a subject's title, description, color, or icon, so that I can keep my subjects organized.
4. As a learner, I want to delete a subject, so that I can remove subjects I no longer need.
5. As a learner, I want to see a subject detail page with all its cards listed, so that I can manage cards within a subject.
6. As a learner, I want subject card count to always be accurate (computed on demand), so that I never see stale counts.

### Cards

7. As a learner, I want to create a card with a Markdown question, Markdown answer, optional hints (ordered), and optional tags, so that I can build my study material.
8. As a learner, I want to see a list of all cards in a subject, so that I can browse and manage my cards.
9. As a learner, I want to edit a card's question, answer, hints, or tags, so that I can improve my cards over time.
10. As a learner, I want to delete a card, so that I can remove cards I no longer need.
11. As a learner, I want my card content rendered as Markdown with syntax-highlighted code blocks, so that technical content is readable.

### Learning Session

12. As a learner, I want to start a learning session for a specific subject, so that I can focus my study on one topic.
13. As a learner, I want to start a "Review all" session across all subjects, so that I can review mixed content.
14. As a learner, I want overdue cards to appear first in a session (most overdue first), so that I prioritize cards I'm at risk of forgetting.
15. As a learner, I want new cards to fill remaining session capacity but capped at 30% of total, so that I'm not overwhelmed with unseen material.
16. As a learner, I want to see the card's question first, then optionally reveal hints one at a time, then reveal the answer, so that I practice active recall.
17. As a learner, I want to rate my review with "Wrong" or "Right", and if right, choose "Hard", "Good", or "Easy", so that the algorithm can schedule my next review.
18. As a learner, I want hint usage to cap my quality at 3 regardless of my self-assessment, so that cards I needed help with are scheduled sooner.
19. As a learner, I want the session to end when no more eligible cards remain or when I choose to stop, so that sessions are flexible.
20. As a learner, I want to see a session summary at the end showing cards reviewed, accuracy, and time spent, so that I can reflect on my study session.
21. As a learner, I want my daily goal progress bar to update in real-time as I complete reviews, so that I can track my progress toward the goal.

### SM-2 Algorithm

22. As a learner, I want my card intervals to grow as I consistently answer correctly, so that well-known cards appear less frequently.
23. As a learner, I want a failed card (quality < 3) to reset to a 1-day interval, so that I re-learn forgotten material.
24. As a learner, I want my ease factor to adjust based on performance (floor 1.3, ceiling 2.5), so that card scheduling adapts to my learning pattern.
25. As a learner, I want my card status to progress from New → Learning → Reviewing → Mastered as I demonstrate mastery, so that I can see my progress.

### Review History

26. As a learner, I want every review to be logged immutably (quality, time spent, hint usage, timestamp), so that my learning data is preserved for future analytics.

## Implementation Decisions

- **Subjects module** (controller + service): `GET /v1/subjects` returns the list envelope with computed card count (COUNT query, not stored). `POST /v1/subjects`, `PATCH /v1/subjects/:id`, `DELETE /v1/subjects/:id`, `GET /v1/subjects/:id/stats` — standard CRUD. All filter by `userId` from the `JwtAuthGuard` (`request.user`). Delete hard-cascades to cards, cardProgress, and reviewHistory for that subject's cards (frontend shows a confirmation dialog; past dashboard stats shift retroactively).
- **Cards module** (controller + service): `GET /v1/cards?subject=:id`, `GET /v1/cards/:id`, `POST /v1/cards`, `PATCH /v1/cards/:id`, `DELETE /v1/cards/:id` — standard CRUD. Hints stored as JSON array of strings. Tags stored as JSON array of strings. Cards belong to a subject; authorization verified by checking subject ownership. No `expand[]` — the card carries `subjectId` and the frontend joins from the cached subjects list.
- **SM-2 service** (Nest provider): Pure function `calculateNextReview(quality, lastInterval, lastEaseFactor, repetitions)` returns `{ newInterval, newEaseFactor, newRepetitions }`. Logic as defined in architecture.md section 7. Status derived from progress state: New (0 repetitions), Learning (1-3 reps, interval < 7), Reviewing (stable intervals), Mastered (interval > 21, ease > 2.0).
- **Learning service** (Nest provider): `getSessionCards(userId, subjectId?)` — queries overdue cards ordered by staleness, then fills with new cards (max 30% of batch). `submitReview(userId, cardId, quality, timeSpent, wasHintUsed)` — calls SM-2, updates cardProgress, inserts reviewHistory.
- **Reviews module** (controller + service): `GET /v1/review_queue?subject=:id` returns due/new/total counts; `GET /v1/review_queue/next?subject=:id` returns the next card to review (`204` if none). `POST /v1/reviews` accepts the review submission (`{ cardId, quality, timeSpent, wasHintUsed }`) and returns the updated `CardProgress`. No idempotency key — the frontend disables the submit button while the mutation is pending (TanStack Query mutations don't auto-retry), so SM-2 can't be advanced twice. All delegate to the learning/SM-2 providers.
- **Frontend integration**: Replace mock data in SubjectList, SubjectCard, SubjectDetail, CardList, CardForm, CardReview, QualityButtons, SessionSummary with real REST calls via the generated typed client + TanStack Query. Query hooks in `api/queries/` wrap `api/client.ts`; mutations invalidate the relevant query keys `onSuccess`.
- **Optimistic updates**: Not required in this phase. Standard invalidation-on-mutation is sufficient.
- **Card selection is server-side**: The frontend requests the next card; the backend determines which card to show based on the SM-2 schedule. The frontend does not hold the full card queue.

## Testing Decisions

No tests in this phase. Manual validation of the full learning loop: create subject → create cards → start session → review cards → verify scheduling.

## Out of Scope

- Dashboard stats (accuracy, streaks, weak cards) — that's FRD-005
- Frontend animations and polish — already done in FRD-001, refined in FRD-004
- Bulk card import/export
- Card search or filtering by tags
- Automated tests

## Further Notes

- The SM-2 service is the most critical module in the entire application. Even though there are no automated tests in this phase, the algorithm should be manually verified with known inputs/outputs from the SM-2 specification.
- After this phase, the app is functionally complete for the core learning loop. A learner can sign up, create subjects and cards, and study with spaced repetition scheduling.
- Quality 0 and 2 are not reachable through the UI (as defined in CONTEXT.md). The SM-2 function should still handle them gracefully but the UI only produces 1, 3, 4, or 5.
