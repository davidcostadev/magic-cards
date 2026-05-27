# Issue 006: Dashboard — Stats, Streak, Weak cards, Upcoming reviews, Daily goal

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: ready-for-agent

---

## What to build

Build the dashboard page — the learner's home screen after logging in. It shows a read-only view of learning progress using mock data. The dashboard should feel motivating (Duolingo-inspired) with clear visual hierarchy.

Widgets to implement:
- **Daily goal progress**: A progress bar showing cards reviewed today vs. daily goal (e.g., "12 / 20 reviews"). Prominent, top of page.
- **Streak widget**: Current streak count (consecutive days meeting goal) with visual emphasis (fire icon, highlighted number).
- **Accuracy rate**: Percentage of reviews with quality >= 3, shown for 7-day and 30-day periods. Can use tabs or side-by-side display.
- **Cards by status**: Breakdown of New / Learning / Reviewing / Mastered cards, shown as a summary (counts or small chart). Include per-subject breakdown and total.
- **Weak cards**: List of 5-10 cards with lowest ease factor, showing question preview and subject. Links to start a focused review.
- **Upcoming reviews**: Counts for today, tomorrow, and this week. Simple counts or small calendar-like display.

All data is mock. The mock data should be realistic enough to evaluate the information hierarchy — some subjects with more mastered cards, some with more weak cards, a streak of a few days, etc.

## Acceptance criteria

- [ ] DashboardPage at `/dashboard` renders all widgets in a responsive grid layout
- [ ] Daily goal progress bar prominent at top, showing "X / Y reviews today"
- [ ] StreakWidget displays consecutive day count with visual emphasis
- [ ] Accuracy widget shows percentage for 7-day and 30-day periods
- [ ] Cards by status shows New/Learning/Reviewing/Mastered counts (total + per subject)
- [ ] WeakCardsWidget lists 5-10 mock cards with lowest ease factor, showing question preview and subject name
- [ ] UpcomingReviews shows counts for today, tomorrow, and this week
- [ ] "Start studying" call-to-action button visible on the dashboard
- [ ] Mock data realistic — varied subjects, mixed card statuses, multi-day streak
- [ ] Empty states for widgets when applicable (e.g., no weak cards yet, no reviews today)
- [ ] Page responsive on mobile (375px) — widgets stack vertically on small screens
- [ ] All visible text uses i18n `t()` function with EN/PT translations

## Blocked by

- Issue 001 (Frontend scaffold)
