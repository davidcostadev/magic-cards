# Issue 005: Review flow — CardReview + Hints + Answer + Quality rating + Session summary

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: ready-for-agent

---

## What to build

Build the complete learning session experience — the core product interaction. This is the most important UI in the application.

The review flow follows this sequence for each card:
1. **Question displayed** — rendered Markdown with syntax-highlighted code blocks (react-markdown + rehype-highlight or shiki)
2. **Hint reveal** — learner clicks a "Show hint" button; hints appear one at a time, inline below the question, with a fade-in animation. Once revealed, hints stay visible. A badge or indicator shows "Hint used" status.
3. **Answer reveal** — learner clicks "Reveal answer"; the answer slides/fades in below the question (not a card flip — Markdown content has variable height). Animation should be smooth, under 300ms.
4. **Quality rating** — two-step hybrid: first "Wrong" / "Right" buttons; if "Right", then "Hard" / "Good" / "Easy" buttons appear. The mapping to quality (1, 3, 4, 5) should be visually clear through button colors/styling.
5. **Next card** — after rating, the next mock card loads. A progress indicator shows position in the session (e.g., "5 of 12").

After all cards are reviewed (or the learner clicks "End session"), show a **SessionSummary** with: cards reviewed count, accuracy percentage, time spent, and a "Back to dashboard" button.

Use a mock card queue (5-8 cards with realistic programming content including multi-line code blocks). The daily goal progress bar should update as cards are reviewed.

## Acceptance criteria

- [ ] LearningSessionPage at `/learn` (all subjects) and `/learn/:subjectId` (single subject)
- [ ] Card question rendered as Markdown with syntax-highlighted code blocks
- [ ] "Show hint" button reveals hints one at a time with fade-in animation
- [ ] Hint usage visually indicated (badge or label)
- [ ] "Reveal answer" button triggers slide/fade animation, answer appears below question
- [ ] Two-step quality rating: "Wrong"/"Right" first, then "Hard"/"Good"/"Easy" if right
- [ ] Quality buttons visually differentiated (color-coded: red for wrong, yellow for hard, green for good, bright green for easy)
- [ ] Progress indicator showing current card position in session (e.g., "Card 3 of 10")
- [ ] Daily goal progress bar visible during session, updating as reviews complete
- [ ] "End session" button available at any time to stop early
- [ ] SessionSummary shown at end: cards reviewed, accuracy %, time spent, "Back to dashboard" link
- [ ] Mock card queue includes 5-8 cards with realistic programming content (TypeScript, SQL, code blocks)
- [ ] Animations are smooth and under 300ms
- [ ] Page responsive on mobile (375px) — review flow must feel natural on phone
- [ ] All visible text uses i18n `t()` function with EN/PT translations

## Blocked by

- Issue 001 (Frontend scaffold)
