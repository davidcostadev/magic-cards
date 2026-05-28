# Issue 004: Subject detail — Card list + Card create/edit form

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: done

---

## What to build

Build the subject detail page (`/subjects/:id`) showing the subject header (title, description, color, icon) and a list of all cards within it. Each card in the list shows a preview of the question (first line or truncated text). Include a card creation form and an edit modal.

CardForm fields: question (Markdown textarea), answer (Markdown textarea), hints (ordered list — add/remove/reorder), tags (tag input). The form is used for both creation and editing.

Cards with Markdown content should show a preview of the rendered question in the list view. The full Markdown rendering (with syntax highlighting) is handled in the review flow (Issue 005), but the list should at least show a clean text preview.

Mock data should include realistic programming content — TypeScript questions, SQL examples, algorithm explanations — to validate how technical content looks in the card list.

## Acceptance criteria

- [ ] SubjectDetail page at `/subjects/:id` shows subject header (title, description, color, icon)
- [ ] CardList renders all cards for the subject, showing a truncated question preview per card
- [ ] "Add card" button opens CardForm with question, answer, hints, and tags fields
- [ ] Hints field allows adding, removing, and reordering hints (ordered list UI)
- [ ] Tags field allows adding and removing tags
- [ ] Edit action on a card opens CardEditModal pre-filled with card data
- [ ] Delete action on a card removes it from the local mock state
- [ ] Empty state shown when subject has no cards, with a call-to-action to create one
- [ ] Mock cards include realistic programming/tech content (TypeScript, SQL, etc.)
- [ ] "Start studying" button visible that navigates to `/learn/:subjectId`
- [ ] Page responsive on mobile (375px) and desktop
- [ ] All visible text uses i18n `t()` function with EN/PT translations

## Blocked by

- Issue 003 (Subjects page — needs subject context and navigation)
