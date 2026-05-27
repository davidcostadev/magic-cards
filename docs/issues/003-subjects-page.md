# Issue 003: Subjects page — List, SubjectCard, Create/Edit modal

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: ready-for-agent

---

## What to build

Build the subjects list page showing the learner's subjects as cards in a responsive grid. Each SubjectCard displays title, description, color accent, icon, and a computed card count. Include a "Create subject" button that opens a CreateSubjectModal with title, description, color picker, and icon selector fields. The same modal (or a variant) handles editing existing subjects.

All data comes from mock objects matching the subjects and cards schema shapes. Subject card count is computed from the mock cards array — never hardcoded as a property of the subject.

The page should feel like a Duolingo-style subject picker: visually distinct cards with color accents, inviting the learner to start studying.

## Acceptance criteria

- [ ] SubjectsPage renders a responsive grid of SubjectCard components (1 column on mobile, 2-3 on desktop)
- [ ] SubjectCard shows title, description (truncated), color accent, icon, and computed card count
- [ ] "Create subject" button opens CreateSubjectModal with title, description, color picker, and icon selector
- [ ] Edit action on SubjectCard opens the same modal pre-filled with subject data
- [ ] Delete action on SubjectCard removes it from the local mock state
- [ ] Creating/editing a subject updates the local mock state and the list re-renders
- [ ] Subject card count is computed from mock cards array, not stored on the subject object
- [ ] Clicking a SubjectCard navigates to `/subjects/:id` (subject detail page — placeholder OK at this stage)
- [ ] Empty state shown when no subjects exist, with a call-to-action to create one
- [ ] Page responsive on mobile (375px) and desktop
- [ ] All visible text uses i18n `t()` function with EN/PT translations

## Blocked by

- Issue 001 (Frontend scaffold)
