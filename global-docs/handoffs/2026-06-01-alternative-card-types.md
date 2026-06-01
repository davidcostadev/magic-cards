# Handoff — Implementar tipos alternativos de card (quiz, match, type-answer)

**Data:** 2026-06-01
**Foco da próxima sessão:** adicionar suporte de ponta a ponta a **cards interativos** — `quiz`
(múltipla escolha), `type-answer` (resposta curta digitada) e `match` (associar pares) — além do
`open` (Q&A em Markdown) que já existe.

---

## TL;DR

Hoje o backend só modela cards **open** (pergunta/resposta Markdown + hints + tags). Os tipos
interativos existiram só como **protótipo de UI** (mocks) e foram **removidos como dead code** na
Fase 4 porque o data model não os suportava. Esta tarefa **re-introduz** os 3 tipos *de verdade*:
mudança de schema no backend + validação discriminada + auto-correção/mapeamento SM-2 + recriação
dos componentes de frontend. É uma feature que cruza schema, validação, SM-2/reviews e bastante UI —
**vale começar por um PRD/plano** (ver "Suggested skills").

## Contexto — ler primeiro (NÃO duplicar; referências por caminho)

- `docs/PROJECT_STATUS.md` — estado geral do projeto (este item está em §4 "gaps", como ⏸️ adiado).
- Memória `phase1-card-types-scope` — **a história completa**: o protótipo FRD-001 tinha os 4 tipos;
  o model documentado (architecture §4, FRD-003) só define open; os componentes foram deletados.
- `docs/architecture.md` §4 (schema de `cards`), §6 (endpoints), §5 (camadas), e o fluxo SM-2.
- `CONTEXT.md` — glossário (Card, Subject, Review, SM-2, envelopes Stripe).
- ADR 0004 (nestjs-zod + Drizzle), ADR 0005 (TDD obrigatório p/ lógica).

## Estado atual relevante (verificado nesta sessão)

**Modelo de card hoje** (`packages/backend/src/db/schema.ts`, tabela `cards`):
`id, subjectId, question, answer, hints (jsonb), tags (jsonb), timestamps` — **sem coluna `type`**.

**Fluxo de review hoje** (`packages/backend/src/modules/reviews/`):
`POST /v1/reviews` recebe `{ cardId, quality: 1–5, timeSpent, wasHintUsed }`; o SM-2 consome `quality`.
A UI faz a auto-avaliação manual em dois passos (Wrong / Right→Hard/Good/Easy) → mapeia para `quality`.
Para cards **auto-corrigíveis** (quiz/type-answer/match), há uma decisão nova: como derivar `quality`
a partir de acerto/erro (ver "Decisões em aberto").

**Componentes de UI deletados — recuperáveis do git** (existiam até `1b30df2`, removidos em `0f6a9c3`):
```
git show 1b30df2:packages/frontend/src/components/features/learning/QuizReview.tsx
git show 1b30df2:packages/frontend/src/components/features/learning/TypeAnswerReview.tsx
git show 1b30df2:packages/frontend/src/components/features/learning/MatchReview.tsx
git show 1b30df2:packages/frontend/src/components/features/learning/StudyModeModal.tsx
```
Servem de base, mas precisam ser religados ao client tipado real (não aos mocks).

**Dados de referência** — `packages/frontend/src/mocks/content.json` (77 cards, 4 tipos) mostra os
shapes esperados:
- `quiz` → `choices: [{ id, text, isCorrect }]` (a `answer` é a explicação)
- `type-answer` → `shortAnswer: "Partial"` (+ hints); `answer` é a explicação
- `match` → `matchPairs: [{ left, right }]`
- todos têm um campo `language` no protótipo (decidir se entra no model)

**Componentes de aprendizado atuais** (open): `CardReview, AnswerReveal, HintReveal,
MarkdownContent, SessionSummary, Timer`. Autoria: `CardForm.tsx` (open-only), `CardList.tsx`.

## O que esta feature exige (escopo de alto nível)

1. **Backend — schema/migration:** coluna `type` (`open|quiz|type-answer|match`) + dados específicos
   (decisão: um `jsonb payload` único *vs.* colunas discretas `choices/shortAnswer/matchPairs`).
   Gerar migração Drizzle (`pnpm --filter backend db:generate`).
2. **Backend — validação:** `createCardSchema` vira **discriminated union** por `type` (open exige
   answer; quiz exige ≥1 choice correta; type-answer exige `shortAnswer`; match exige `matchPairs`).
   Regerar contrato: `pnpm gen:api` (openapi.json + client; CI tem drift check).
3. **Backend — correção + SM-2:** onde corrigir os tipos auto-corrigíveis e como mapear acerto/erro →
   `quality`. Cuidado: type-answer precisa de **comparação normalizada** de string (trim/case/acentos).
   `reviews`/`learning` são lógica → **TDD** (teste primeiro).
4. **Frontend — estudo:** `CardReview` despacha por `type`; recriar/adaptar Quiz/TypeAnswer/Match;
   manter acessibilidade (teclado, foco, estados) conforme o guia global.
5. **Frontend — autoria:** estender `CardForm` para criar cada tipo; i18n (en/pt).
6. **Conteúdo (opcional):** estender `seed:catalog` / ingerir `content.json` quando os tipos existirem.

## Decisões em aberto (fechar no começo — viram o PRD)

- **Modelagem dos dados por tipo:** `jsonb payload` único *vs.* colunas tipadas. (jsonb = migração
  simples e flexível; colunas = mais explícito/consultável.)
- **Quem corrige & mapeamento de `quality`:** cliente envia `quality` derivado de correção local, ou o
  servidor corrige? Para não enviar a resposta ao cliente em quiz/type-answer, **corrigir no servidor**
  (novo endpoint/campo) é mais seguro — decidir. Definir o mapa acerto/erro → SM-2 (ex.: errou→1/2,
  acertou→4, com nuance Hard/Easy só no open).
- **`language` por card** entra no model ou fica fora? (protótipo tinha; FRD-003 não.)
- **Match — granularidade da nota:** tudo-ou-nada vs. parcial.

## Definition of done

Os 4 tipos: criáveis (CardForm + `POST /v1/cards`), persistidos (schema+migração), validados
(Zod union + OpenAPI regen sem drift), estudáveis com correção correta e progresso SM-2, e cobertos
por testes (Vitest backend p/ correção+mapeamento; RTL p/ os componentes). Lint + type-check limpos.

## Restrições do projeto a respeitar

- **TDD** para lógica (ADR 0005): teste falhando → implementação. Vitest usa Postgres **em memória**
  (PGlite) — não suja o banco de dev.
- **i18n só no frontend**; backend devolve `error.code`. Envelopes Stripe (list/error).
- **Acessibilidade**: todo elemento interativo com hover/active/focus-visible + teclado (guia global).
- **Sem `Co-Authored-By`** nos commits.

## Suggested skills (invocar conforme a fase)

- **`to-prd`** — escrever o PRD desta feature primeiro (fecha as "Decisões em aberto" acima).
- **`database-migration`** — desenhar/gerar a migração Drizzle do `cards` (coluna `type` + dados).
- **`nestjs-best-practices`** — implementação do backend (DTOs Zod, service de correção, reviews).
- (opcional) **`grill-me`** / **`grill-with-docs`** — pressionar os requisitos antes de codar.
