# Handoff — Bulk-author public catalog content (~100 mixed-type cards per subject)

**Date:** 2026-06-01
**Next session focus (user):** *"adicionar mais conteúdos públicos — tipo 100 cards com diferentes formas
para cada assunto."* → Author and import ~100 cards **per subject**, using **all four card types**
(open / quiz / type-answer / match), into the **public catalog**.

---

## TL;DR

The mechanism is **done and live** — bulk JSON import via `POST /v1/catalog/import` (x-api-key). The work
left is **content authoring at volume**: bring each subject up to ~100 quality, accurate, mixed-type cards.
**Read [`docs/content-authoring.md`](../../docs/content-authoring.md) first** — it has the exact JSON shape,
per-type rules, the curl, and the AI-authoring workflow. Don't re-derive any of that here.

## Step 0 — read the existing content before authoring (avoid dupes, get the real ids)

```bash
KEY=$(grep CONTENT_API_KEY packages/backend/.env | cut -d= -f2)   # key lives in packages/backend/.env
curl -sS http://localhost:3001/v1/catalog/export -H "x-api-key: $KEY" > /tmp/catalog.json
```
`export` returns `{ subjects, cards }` with the **real subject ids** and every existing card. To add to an
existing subject you **must reference its actual `subjectId`** (else a new subject is created). Also scan it
so you don't re-author questions that already exist.

## Current inventory (2026-06-01) — the gap to ~100 each

12 public subjects, 93 cards total; overall mix open 32 / quiz 23 / type-answer 23 / match 15.

| Subject | cards now | needs (~) |
|---|---|---|
| TypeScript | 15 | +85 |
| React | 15 | +85 |
| JavaScript | 13 | +87 |
| Algorithms | 12 | +88 |
| Linux & Bash | 12 | +88 |
| SQL | 5 | +95 |
| CSS | 4 | +96 |
| Docker | 4 | +96 |
| Git | 3 | +97 |
| Node.js | 3 | +97 |
| Python | 3 | +97 |
| **TypeScript (example)** | 4 | **delete — dup of TypeScript** (`DELETE /v1/catalog/subjects/example-ts`) |

> The 10 original subjects + their ids came from a seed that was **removed** (commit `51249b2`); they exist
> only in the local dev DB now (see "Reproducibility"). `linux-cli` and `example-ts` were added this session
> via the import API.

## Recommended approach

1. **Per subject, author ~100 cards with a varied mix.** Suggested distribution (tune per subject —
   commands suit type-answer/match; concepts suit open/quiz): **open ~40, quiz ~25, type-answer ~20,
   match ~15**.
2. **Stable, namespaced card ids** so re-imports upsert instead of duplicating, e.g.
   `ts-open-001`, `ts-quiz-001`, `ts-match-001`. Include the subject in the import too (with its real id)
   so it upserts.
3. **One subject per import request** (limit is 5000 cards/request, so 100 fits easily). Check the response
   `errors[]` — invalid cards are skipped and reported with their array `index`; fix just those and
   re-import (idempotent).
4. **Quality bar:** this is educational content — keep it accurate and non-duplicative. Respect the rules
   (quiz = exactly one correct choice; type-answer needs `shortAnswer`; match = 2–12 pairs). See
   `docs/content-authoring.md` §3/§6/§8.
5. **Verify** a subject in the app afterwards (it should appear in the study queue with the new cards).

## ⚠ Decision to raise with the user FIRST — reproducibility

Content currently lives **only in the local dev DB** (`packages/backend/data/pg`, gitignored, PGlite —
persists across restarts but is per-machine and lost on a fresh/prod DB). Authoring ~1,000+ cards and
leaving them only there is fragile. **Recommend saving the per-subject decks as JSON in the repo** (e.g.
`content/<subject>.json`) so they're durable and re-importable. This is *not* the same as the auto-seed the
user removed (commit `51249b2`) — it's just keeping the source files to import manually. Confirm the user's
preference before authoring at scale.

## Scale note (optional)

~100 cards × ~11 subjects ≈ 1,000+ cards is a large authoring job. If the user opts in, this is a good fit
for the **Workflow** tool (multi-agent fan-out — one agent per subject authoring its deck JSON in parallel,
then import each). Workflow requires explicit user opt-in; don't launch it unprompted.

## Environment state

- **Backend running on `:3001`** (`nest start --watch`, pre-existing — not cleanly owned by this session;
  don't kill blindly). `CONTENT_API_KEY` is in `packages/backend/.env` (do not paste the value into docs).
- **Dev DB** `packages/backend/data/pg` holds the inventory above. Persists across restarts.
- **Branch `main`: 6 unpushed commits** (CORS/E2E, dataset, seed removal, import/export, authoring docs, and
  a handoff). User hasn't authorized a push.
- **Global heavy-op lock** active from new sessions (`~/.claude/hooks/`); inspect/unlock with
  `python3 ~/.claude/hooks/heavy_op_lock.py status|unlock`.

## Related / not this task
- **Open bug** (separate handoff `global-docs/handoffs/2026-06-01-card-action-buttons-missing.md`): the
  New Card / Edit / Delete buttons "disappeared" — most likely because catalog subjects are read-only by
  design (`isPublic`). Importing *more* public content does **not** fix that; it's a frontend/UX issue.
- Import/export + card-type internals: `docs/content-authoring.md`, `docs/content-catalog.md`,
  `docs/examples/catalog-import.example.json`; commits `76f9705`, `54410bd`.

## Suggested skills
- **`verify`** (or **`run`**) — after importing a subject's deck, launch the app and confirm the cards
  appear and study/grade correctly (all four types).
- *(Tool, not a skill)* consider proposing the **Workflow** multi-agent tool to the user for authoring many
  subjects' decks in parallel — only with explicit opt-in.
