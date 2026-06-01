# Content Catalog — Publishing Shared Content

The **catalog** lets a trusted operator publish **shared subjects and cards** that are
**auto-available** (read-only) to every learner — alongside their own private content. It is
authorized by a single server-side **API key**, not a user login. See ADR 0007 for the design.

> **TL;DR:** set `CONTENT_API_KEY` on the backend, then `POST /v1/catalog/subjects` and
> `/v1/catalog/cards` with an `x-api-key` header. Published content shows up for everyone,
> read-only.

---

## 1. The API key (`CONTENT_API_KEY`)

This is a **server secret**, not a per-user setting in the app. There is intentionally **no
UI** to read it — exposing it would let anyone publish public content.

**Generate a strong value (≥ 16 chars):**

```bash
openssl rand -hex 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Set it:**

- **Local dev** — in `packages/backend/.env` (git-ignored):
  ```
  CONTENT_API_KEY=<your-long-random-value>
  ```
  Restart the backend (`pnpm --filter backend dev`) so it picks up the change.
- **Production** — as an environment variable / secret on your host (Fly.io, Railway, …).
  Never commit it.

> If `CONTENT_API_KEY` is **unset**, the catalog is **disabled** — every `POST /v1/catalog/*`
> returns `401`. That is the default.

---

## 2. Authentication

Send the key in the **`x-api-key`** header on the catalog endpoints. No JWT is needed (and a
JWT alone is not accepted — these routes are key-only):

```
x-api-key: <CONTENT_API_KEY>
```

A missing/wrong key → `401 { "error": { "code": "catalog.invalidApiKey" } }`.
Catalog disabled (no key configured) → `401 { "error": { "code": "catalog.disabled" } }`.

---

## 3. Endpoints

| Method & Path | Auth | Body | Response |
|---|---|---|---|
| `POST /v1/catalog/subjects` | `x-api-key` | `{ title, description?, color?, icon? }` | `201` public `Subject` (`isPublic: true`) |
| `POST /v1/catalog/cards` | `x-api-key` | `{ subjectId, question, answer, hints?, tags? }` | `201` `Card` (must target a public subject) |
| `DELETE /v1/catalog/subjects/:id` | `x-api-key` | — | `204` (removes a public subject **and its cards**); `404` if it isn't a public catalog subject |

Cards can only be added to a **public** subject id (one returned by `POST /catalog/subjects`).
Targeting a private/non-existent subject → `404`.

`DELETE` is scoped to public, system-owned content: deleting a regular user's subject (or a
missing id) returns `404` — the key can never remove a user's own deck. The delete cascades to
the subject's cards (and any per-user progress/history on them).

---

## 4. Examples

Assuming the backend runs on `http://localhost:3001` and your key is in `$CONTENT_API_KEY`:

**Publish a subject:**

```bash
curl -sS -X POST http://localhost:3001/v1/catalog/subjects \
  -H "x-api-key: $CONTENT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"title":"SQL Basics","description":"Core SQL queries","color":"#336791","icon":"database"}'
# → { "id": "019e...", "isPublic": true, "title": "SQL Basics", ... }
```

**Publish a card into that subject** (use the `id` from above):

```bash
curl -sS -X POST http://localhost:3001/v1/catalog/cards \
  -H "x-api-key: $CONTENT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
        "subjectId": "019e...",
        "question": "What does SELECT do?",
        "answer": "Reads rows from a table.",
        "hints": ["It does not modify data"],
        "tags": ["sql", "basics"]
      }'
```

**Seed many cards in one go** (bash):

```bash
SUBJECT_ID=$(curl -sS -X POST http://localhost:3001/v1/catalog/subjects \
  -H "x-api-key: $CONTENT_API_KEY" -H 'Content-Type: application/json' \
  -d '{"title":"SQL Basics"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")

publish_card() {
  curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/v1/catalog/cards \
    -H "x-api-key: $CONTENT_API_KEY" -H 'Content-Type: application/json' \
    -d "{\"subjectId\":\"$SUBJECT_ID\",\"question\":\"$1\",\"answer\":\"$2\"}"
}

publish_card "What does INSERT do?" "Adds new rows."
publish_card "What does WHERE filter?" "Rows matching a condition."
```

Question and answer accept **Markdown** (including fenced code blocks), exactly like
user-authored cards.

**Remove a published subject** (and its cards):

```bash
curl -sS -X DELETE http://localhost:3001/v1/catalog/subjects/019e... \
  -H "x-api-key: $CONTENT_API_KEY" -i   # → HTTP/1.1 204 No Content
```

---

## 4b. Bulk import / export (JSON)

For loading or editing many cards at once — e.g. an **AI authoring a JSON file** — the catalog
has a symmetric import/export pair (same `x-api-key`). The document shape is
`{ "subjects": [...], "cards": [...] }`; **export returns exactly what import accepts**, so you
can export → edit the JSON → re-import.

**Import** — `POST /v1/catalog/import`. Subjects are upserted (give each a stable `id` so cards can
reference it and so re-importing updates instead of duplicating). Each card is validated against the
same per-type rules as the single-card API (a quiz needs exactly one correct choice, type-answer
needs a `shortAnswer`, match needs ≥2 pairs). **Invalid cards are skipped and reported** in `errors`
(with their array `index`) so one bad card never sinks the whole batch:

```bash
curl -sS -X POST http://localhost:3001/v1/catalog/import \
  -H "x-api-key: $CONTENT_API_KEY" -H 'Content-Type: application/json' \
  --data @docs/examples/catalog-import.example.json
# → { "subjects": {"created":1,"updated":0}, "cards": {"created":4,"updated":0}, "errors": [] }
```

A ready-to-use template lives at [`examples/catalog-import.example.json`](./examples/catalog-import.example.json)
(one subject + one card of every type). Card fields per type:

- `open` → `question`, `answer`
- `quiz` → `question`, `answer` (explanation), `choices: [{ id, text, isCorrect }]` (exactly one correct)
- `type-answer` → `question`, `answer` (explanation), `shortAnswer` (matched case/accent/space-insensitive)
- `match` → `question`, `matchPairs: [{ left, right }]` (`answer`/explanation optional)
- any type also accepts `hints: string[]`, `tags: string[]`, and an optional `id` (upsert key).

**Export** — `GET /v1/catalog/export` (optionally `?subject=<id>`) dumps all public content as the
same JSON, ids included:

```bash
curl -sS http://localhost:3001/v1/catalog/export -H "x-api-key: $CONTENT_API_KEY" > catalog.json
# edit catalog.json, then re-import it (idempotent — ids upsert)
```

> **AI workflow:** the contract is in `openapi.json` (tag `catalog`). An agent generates a JSON file
> in the shape above and `POST`s it to `/v1/catalog/import`; the `errors[]` array tells it exactly
> which cards to fix and re-send. A future MCP server could wrap these two endpoints as tools.

---

## 5. What learners see

- The shared subject appears in **every** learner's `GET /v1/subjects` list, marked **Shared**
  in the UI.
- Its cards are included in the **study queue** (`/v1/review_queue`) and can be reviewed like
  any other card; each learner keeps their **own** SM-2 progress and review history.
- It is **read-only**: a learner editing/deleting shared content gets `404`. The UI hides the
  edit/delete and "New Card" actions on shared subjects.

---

## 6. Security notes

- The key is checked in **constant time**; rotate it by changing the env var and restarting.
- Scope is **catalog-only** — publish and delete **public** content (system-owned). The key
  grants no access to user data and cannot touch a user's own subjects/cards.
- This is a **curated** model (one trusted key publishes). It is **not** user-generated
  content: there is no per-user public publishing and no moderation. Adding that later would
  build on the `isPublic` flag but needs its own authorization + review (ADR 0007).
