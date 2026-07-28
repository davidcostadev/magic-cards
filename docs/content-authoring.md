# Content Authoring Guide — cards, subjects, catalog, queries

How to **add**, **query**, and **bulk-import** learning content, and the exact shape and rules of
every **card type**. Written so a human *or an AI* can author content reliably. The machine-readable
contract is `packages/backend/openapi.json` (Swagger UI at `/docs`).

> Companion docs: [`content-catalog.md`](./content-catalog.md) (catalog auth/visibility, `x-api-key`),
> [`architecture.md`](./architecture.md) §4/§6 (schema + endpoints), [`../CONTEXT.md`](../CONTEXT.md)
> (domain glossary).

---

## 1. Where content lives — two surfaces

| Surface | Owner | Auth | Visible to | Use for |
|---|---|---|---|---|
| **User deck** | a specific user | JWT (`Authorization: Bearer …`) | only that user | a person's private cards |
| **Public catalog** | the system user | `x-api-key` header (`CONTENT_API_KEY`) | **every** learner (read-only) | shared/curated content, **AI-authored content** |

For "an AI adds cards," use the **catalog** — no user login, content is shared with everyone, and there's
a bulk **import** endpoint. The key only ever touches public, system-owned content; it can never modify a
user's private deck.

---

## 2. Subjects (the "categories")

A **subject** groups related cards (e.g. "Linux & Bash", "TypeScript"). Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | optional on create; provide a stable id so cards can reference it and re-imports upsert |
| `title` | string | required |
| `description` | string | optional |
| `color` | string | optional, hex (e.g. `#fcc624`) — used in the UI |
| `icon` | string | optional, icon name (e.g. `terminal`, `code`, `git-branch`) |

A subject's **card count is computed on demand**, never stored. Create a catalog subject with
`POST /v1/catalog/subjects` (or include it in an import; see §5).

---

## 3. Card types

Every card has: `id?`, `subjectId`, `type` (default `open`), `question` (Markdown), optional
`hints: string[]` (max 10), optional `tags: string[]` (max 20). The rest is type-specific.
Optional too: `language` (`en`|`pt`, default `en`) — the primary content language — and
`translations` (`{ en?: { question, answer }, pt?: { question, answer } }`) — alternate-language
renderings of the question/answer, viewed via the bilingual toggle. Only `question`/`answer`
translate; `choices`/`shortAnswer`/`matchPairs` stay in the primary language (they're usually code).

`open` is **self-assessed**; `quiz` / `type-answer` / `match` are **graded server-side** — the answer is
never sent to the learner before they answer (see §7).

### 3.1 `open` — Markdown Q&A
The original flashcard: a question and a Markdown **answer** the learner reveals and self-rates.

```json
{
  "type": "open",
  "subjectId": "linux-cli",
  "question": "What is the difference between `>` and `>>`?",
  "answer": "`>` truncates (overwrites); `>>` appends. Both create the file if missing.",
  "hints": ["One destroys the file's existing contents."],
  "tags": ["shell"]
}
```
- **Requires:** `answer` (Markdown).
- **Study:** read → *Reveal Answer* → rate **Wrong** / **Right** → (if Right) **Hard / Good / Easy**.

#### What the Markdown renderer supports

Question and answer go through the same renderer, which is CommonMark + **GFM**:

- **Fenced code**, syntax-highlighted and theme-aware.
- **Tables** (GFM pipe tables). Wide ones scroll sideways on their own, so a table never
  stretches the card on a phone.
- **Mermaid diagrams** — a ` ```mermaid ` fence renders as a diagram, the way VS Code and GitHub
  do. Good for a loop, a decision tree, or a sequence that a table would flatten:

  ````markdown
  ```mermaid
  graph TD
    A[Model responds] --> B{stop_reason?}
    B -->|tool_use| C[Run tool, append result]
    C --> A
    B -->|end_turn| D[Done]
  ```
  ````

  Mermaid is loaded **lazily** — a card without a diagram downloads none of it. A diagram that
  fails to parse falls back to showing its source, so a typo never blanks out the card.
- Strikethrough, task lists, and autolinks (also GFM).

> **Leading content:** the renderer promotes the first paragraph to a bold title above the answer
> card. A card that *starts* with a table or diagram has no such paragraph and renders whole — but
> a one-line lead in front of it usually reads better.

### 3.2 `quiz` — multiple choice
Pick one option; the server says which was correct and shows the explanation.

```json
{
  "type": "quiz",
  "subjectId": "linux-cli",
  "question": "Which signal does `kill -9` send?",
  "answer": "`-9` is SIGKILL — forcible, can't be caught. Prefer SIGTERM first.",
  "choices": [
    { "id": "a", "text": "SIGTERM", "isCorrect": false },
    { "id": "b", "text": "SIGKILL", "isCorrect": true },
    { "id": "c", "text": "SIGHUP",  "isCorrect": false }
  ],
  "tags": ["signals"]
}
```
- **Requires:** `answer` (the **explanation**), `choices` (**2–8**, each `{ id, text, isCorrect }`, **exactly one** `isCorrect: true`).
- **Study:** choices are shuffled; picking one submits it → highlights correct/incorrect + explanation.

### 3.3 `type-answer` — short typed answer
The learner types a short answer, compared **leniently** to the accepted answer.

```json
{
  "type": "type-answer",
  "subjectId": "linux-cli",
  "question": "Which command changes a file's permissions?",
  "answer": "`chmod` (change mode) sets read/write/execute bits.",
  "shortAnswer": "chmod",
  "tags": ["permissions"]
}
```
- **Requires:** `answer` (the **explanation**) and `shortAnswer` (the accepted answer).
- **Matching is lenient** (server-side): ignores **case**, **accents/diacritics**, leading/trailing &
  collapsed **whitespace**, and the punctuation `. , ; : ! ? ' " ( )`. (Hyphens are *not* stripped — so
  `-r` must be typed as `-r`.)
- **Study:** type → *Check* → shows whether correct + the accepted answer + explanation.

### 3.4 `match` — associate pairs
Match each left item to its right item. Graded **all-or-nothing**.

```json
{
  "type": "match",
  "subjectId": "linux-cli",
  "question": "Match each command to what it does.",
  "answer": "Optional explanation.",
  "matchPairs": [
    { "left": "ls",  "right": "List directory contents" },
    { "left": "cd",  "right": "Change directory" },
    { "left": "cat", "right": "Print a file's contents" }
  ],
  "tags": ["commands"]
}
```
- **Requires:** `matchPairs` (**2–12**, each `{ left, right }`). `answer` (explanation) is **optional**.
- **Study:** the right column is **shuffled**; pair every left → *Check* → correct only if **all** pairs match.

---

## 4. Adding a single card

### User deck (JWT)
```bash
curl -sS -X POST http://localhost:3001/v1/cards \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "subjectId": "<id>", "type": "open", "question": "Q?", "answer": "A" }'
# → 201 Card  (PATCH /v1/cards/:id to edit, DELETE /v1/cards/:id to remove)
```

### Public catalog (x-api-key)
```bash
curl -sS -X POST http://localhost:3001/v1/catalog/cards \
  -H "x-api-key: $CONTENT_API_KEY" -H 'Content-Type: application/json' \
  -d '{ "subjectId": "<public-subject-id>", "type": "quiz", "question": "…", "answer": "…", "choices": […] }'
# → 201 Card  (the subject must already be a public catalog subject)
```

---

## 5. Bulk import / export (the AI-friendly path)

One request loads many subjects + cards. **Import and export use the same `{ subjects, cards }` shape**,
so content round-trips: export → edit the JSON → re-import.

### Import — `POST /v1/catalog/import` (x-api-key)
```bash
curl -sS -X POST http://localhost:3001/v1/catalog/import \
  -H "x-api-key: $CONTENT_API_KEY" -H 'Content-Type: application/json' \
  --data @my-deck.json
# → { "subjects": {"created":1,"updated":0}, "cards": {"created":12,"updated":0}, "errors": [] }
```
Document shape:
```json
{
  "subjects": [ { "id": "linux-cli", "title": "Linux & Bash", "color": "#fcc624", "icon": "terminal" } ],
  "cards": [ { "id": "c1", "subjectId": "linux-cli", "type": "open", "question": "…", "answer": "…" } ]
}
```
Behaviour:
- **Subjects** are upserted by `id` (omit `id` → a new one is generated; but then cards can't reference it,
  so **give subjects an `id` when cards point at them**).
- **Cards** are validated per type (§3 / §6). A card may target a subject **in this batch** *or* one
  already published.
- **Invalid cards are skipped, not fatal** — each is reported in `errors: [{ index, id?, error }]` so you
  can fix just those and re-send. The rest still import.
- **Idempotent:** provide stable `id`s → re-importing **updates** instead of duplicating
  (`created` vs `updated` counts tell you which).
- Limits: ≤ 500 subjects, ≤ 5000 cards per request.

Ready-to-copy template: [`examples/catalog-import.example.json`](./examples/catalog-import.example.json)
(one subject + one card of every type).

### Export — `GET /v1/catalog/export` (x-api-key)
```bash
curl -sS "http://localhost:3001/v1/catalog/export" -H "x-api-key: $CONTENT_API_KEY" > catalog.json
curl -sS "http://localhost:3001/v1/catalog/export?subject=linux-cli" -H "x-api-key: $CONTENT_API_KEY"
```
Returns `{ subjects, cards }` for all public content (or one subject), **ids included**, with the full
answer data (operator view) — ready to edit and re-import.

---

## 6. Querying / reading content

| Goal | Endpoint | Auth | Notes |
|---|---|---|---|
| List subjects (own + public) | `GET /v1/subjects` | JWT | cursor pagination |
| List a subject's cards | `GET /v1/cards?subject=<id>` | JWT | owner sees full data; non-owner is sanitized (§7) |
| Get one card | `GET /v1/cards/:id` | JWT | own or public |
| **Search/filter/rank catalog cards** | `GET /v1/catalog/cards` | x-api-key | `q`, `type`, `language`, `missing_translation`, `reported`, `sort` + per-card `signals` (see below) |
| **One catalog card + feedback** | `GET /v1/catalog/cards/:id` | x-api-key | adds `signals` + learner `reports[]` |
| **Improve one catalog card** | `PATCH /v1/catalog/cards/:id` | x-api-key | partial edit, re-validated per type |
| Export catalog content | `GET /v1/catalog/export` | x-api-key | full `{subjects,cards}`, with answers |
| Study batch (sanitized) | `GET /v1/review_queue[?subject=]` | JWT | due + new cards, **no answers** |
| Next card to study | `GET /v1/review_queue/next` | JWT | sanitized, or `204` if empty |

> **Finding cards to fix:** `GET /v1/catalog/cards` searches and ranks public cards and decorates
> each with `signals` (global review `accuracy`/`reviewCount`, `reportCount`/`reportsByReason`,
> per-language `translations` completeness). Filter by `missing_translation=pt` to find untranslated
> cards, `sort=most_wrong`/`reported=true` to find weak/flagged ones, then `PATCH` the fix in place.
> Full reference + the AI improvement loop: [`content-catalog.md` §4c](./content-catalog.md).

---

## 7. How grading & sanitization work

**Self-assessed (`open`):** the client sends a `quality` (1–5) it derived from the two-step Wrong/Right
flow; SM-2 consumes it.

**Server-graded (`quiz` / `type-answer` / `match`):** the study payload is **sanitized** — `isCorrect`,
`shortAnswer`, and the match pairing are stripped, and `match` exposes a shuffled
`matchItems: { lefts, rights }` instead of the pairing. The client submits the learner's `response`; the
server grades it and derives the **quality**:

| Outcome | Quality | Effect |
|---|---|---|
| correct | **4** | passes (neutral ease) |
| incorrect | **2** | a lapse — resets the interval |

If any **hint** was used, quality is **capped at 3** (all types). Grading specifics: quiz = the picked
choice's `isCorrect`; type-answer = lenient normalized compare (§3.3); match = all-or-nothing,
order-independent. (Implementation: `modules/learning/grading.service.ts`,
`modules/cards/card-mapper.ts`.)

This is why the grading data is **owner-only**: a learner (or their browser) never receives the answer, so
the auto-graded cards can't be cheated by reading the payload.

---

## 8. Validation rules (server-enforced) — quick reference

| Type | Must have | Constraints |
|---|---|---|
| `open` | `answer` | — |
| `quiz` | `answer`, `choices` | 2–8 choices, **exactly one** `isCorrect` |
| `type-answer` | `answer`, `shortAnswer` | — |
| `match` | `matchPairs` | 2–12 pairs (`answer` optional) |
| *all* | `question` | `hints` ≤ 10, `tags` ≤ 20 |

`type` is **immutable** after creation. A failed rule on a single-card request returns `400`
(`error.param` = the offending field); in a bulk import the bad card is reported in `errors[]` and skipped.
(Implementation: the Zod discriminated rules in `modules/cards/dto/card.dto.ts`.)

---

## 9. The "AI adds cards" workflow

1. The AI reads this guide (or `openapi.json`, tag `catalog`) and writes a JSON file in the §5 shape —
   any mix of card types.
2. `POST /v1/catalog/import` with the `x-api-key`.
3. If `errors[]` is non-empty, the AI fixes exactly those items (the `index`/`error` say what's wrong) and
   re-imports — idempotent, so already-good cards just update.
4. Cards are immediately public: they appear in every learner's subject list and study queue.

**Worked example (done on 2026-06-01):** a 12-card *Linux & Bash* deck (3 of each type) was authored as JSON
and imported via this flow → `{"subjects":{"created":1},"cards":{"created":12},"errors":[]}`, then verified
with `export`. The cards live in the catalog and are studyable in the app.

### Improving existing cards (no seed file needed)

To **edit** the live catalog rather than add to it — translate untranslated cards, fix the ones learners
get wrong, act on reports — work directly against the API:

1. **Find** the slice: `GET /v1/catalog/cards?missing_translation=pt` (or `sort=most_wrong`,
   `reported=true`, `q=…`). Each card carries `signals` (accuracy, report counts, translation status).
2. **Read feedback** when fixing reported/wrong cards: `GET /v1/catalog/cards/:id` returns the learner
   `reports[]` (anonymized) so you know *what* to fix.
3. **Patch** each card: `PATCH /v1/catalog/cards/:id` with only the changed fields (e.g.
   `{ "translations": { "pt": { "question": "…", "answer": "…" } } }`). Re-validated against the card's type.
4. **Confirm & dump:** re-query the filter (it should no longer match), then `GET /v1/catalog/export` for the
   updated seed JSON. The DB stays the source of truth; the seed is a snapshot, not the thing you edit.

> A future **MCP server** could wrap §4–§6 as agent tools (`add_cards`, `import_json`, `export_json`,
> `search_cards`) so an MCP-capable AI manages content as native tools instead of raw HTTP.
