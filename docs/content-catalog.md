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

## 4b. Seeding example content (idempotent)

Instead of hand-rolling `curl` calls, there's a built-in seed that loads the curated dataset
in `packages/backend/src/scripts/catalog-content.json` — **10 subjects** (TypeScript, SQL, React,
Git, JavaScript, CSS, Node.js, Docker, Python, Algorithms) and **77 cards across all four types**
(open 28 / quiz 19 / type-answer 19 / match 11). It's **idempotent** — every row carries the
dataset's stable id and is upserted, so re-running converges to the file's content and never
duplicates:

```bash
pnpm --filter backend seed:catalog
```

- **Dev (PGlite):** the embedded Postgres is single-connection — **stop the dev backend first**
  or the seed can't open the data dir. (With a real `DATABASE_URL` it runs alongside the server.)
- Refuses to run when `NODE_ENV=production` unless `SEED_FORCE=1` is set.
- Edit `catalog-content.json` to change the content; re-running syncs the edits onto the same rows.
  Cards are validated against the same rules as the API (e.g. a quiz needs exactly one correct choice).

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
