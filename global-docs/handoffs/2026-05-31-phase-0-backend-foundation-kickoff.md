# Handoff — Kickoff da Fase 0 (Backend Foundation)

**Data:** 2026-05-31
**Foco da próxima sessão:** começar a *implementar* a Fase 0 — plumbing do monorepo + scaffold do backend (FRD-002), em TDD.

---

## TL;DR — onde estamos

O **plano** foi totalmente redesenhado e commitado nesta sessão (tRPC → REST estilo Stripe + OpenAPI,
sobre **NestJS no adapter Fastify**, com **nestjs-zod**, **Drizzle** mantido, **TDD** + **Playwright E2E
em Docker**). **Nenhuma linha de implementação existe ainda** — `packages/backend` nem foi criado e o
frontend roda 100% em mocks. A próxima sessão começa a construir.

## Fontes da verdade (ler antes de codar — NÃO duplicar aqui)

- `docs/architecture.md` (v3.2) — design completo (schema §4, endpoints §6, camadas §5, testes §11).
- `docs/frd/FRD-002-backend-foundation.md` — **a spec desta fase**. Implementation Decisions já detalhadas.
- `docs/adr/0003` (REST/Stripe/OpenAPI), `0004` (NestJS-Fastify + nestjs-zod + Drizzle), `0005` (TDD +
  Playwright/Docker). `0002` está superseded.
- `CONTEXT.md` — glossário do domínio. `CLAUDE.md` — instruções do projeto (convenções, comandos).

## Reality check do repo (delta que NÃO está nos docs — verificado nesta sessão)

O plano descreve um monorepo back+front que **ainda não existe**. O que falta de fato:

- ❌ `packages/backend/` **não existe** (nem a pasta). Monorepo hoje = só frontend.
- ❌ Frontend **sem** as deps que o plano assume: `vitest`, `playwright`, `@tanstack/react-query`,
  `openapi-fetch`, `openapi-typescript`, `@testing-library/*`. Roda em `packages/frontend/src/mocks/`.
- ⚠️ `package.json` raiz só tem scripts de frontend (`dev/build/lint/test` filtram frontend). **Não bate**
  com os comandos documentados (`pnpm dev` rodando 2 servers, `test:e2e`, `gen:api`, `db:migrate`,
  `db:generate`). Conferir também se `pnpm-workspace.yaml` lista os dois pacotes.
- ❌ Sem `.github/workflows`, sem `docker-compose.e2e.yml`/Dockerfiles, sem `e2e/`, sem `.husky/`.
- 📦 `packages/frontend/src/mocks/content.json` (~78 KB, 45 cards / 10 subjects curados) — precisa de um
  **script de seed** pra entrar no SQLite (decisão em aberto, ver abaixo).

## Sequência sugerida para a Fase 0 (ordem de dependência; tudo TDD por ADR-0005)

Detalhes de cada item estão em `FRD-002`. A ordenação e o plumbing abaixo são o complemento:

1. **Plumbing do monorepo**: criar `packages/backend` (package.json, tsconfig, Dockerfile); corrigir
   scripts do root (`dev` sobe os 2, `test`/`test:e2e`/`gen:api`/`lint`/`type:check`/`db:*`); Husky
   (pre-commit: biome+type:check / pre-push: test+type:check); Biome na raiz.
2. **Backend scaffold (NestJS/Fastify)**: `main.ts` (adapter Fastify, prefixo global `/v1`, swagger,
   pipes/filters/interceptors/guard globais). Deps: `@nestjs/{core,common,platform-fastify,swagger}`,
   `nestjs-zod`, `zod`, `drizzle-orm`, `better-sqlite3`, `drizzle-kit`, `bcrypt`, `jsonwebtoken`(ou `jose`),
   `vitest`, `supertest`, `@nestjs/testing`.
3. **DB**: `db/schema.ts` (5 tabelas, **IDs UUIDv7**), client SQLite, 1ª migração Drizzle.
4. **common/**: `JwtAuthGuard` (+ `@Public()`), `HttpExceptionFilter` (envelope de erro Stripe), list
   interceptor (envelope de lista), helpers de paginação por cursor UUIDv7.
5. **modules/auth** (controller + service + DTOs Zod): `POST /v1/auth/signup`, `/login`; `GET`/`PATCH /v1/me`.
   Test-first: unit do `auth.service`, integração dos endpoints (`@nestjs/testing`+supertest, SQLite real).
6. **gen:api**: script que sobe o Nest **sem `listen`** (`SwaggerModule.createDocument`) e cospe o
   `openapi.json` commitado.
7. **Front (só auth nesta fase)**: instalar deps de api/teste; `api/client.ts` (openapi-fetch + header
   Authorization) + gerar `api/schema.d.ts`; ligar o AuthContext real (substituir mock). TanStack Query.
8. **Harness de teste**: configs Vitest (back+front), Playwright + `docker-compose.e2e.yml` (back+front,
   SQLite descartável) + Dockerfiles + 1 smoke E2E (signup → login).

## Decisões em aberto que tocam a Fase 0 (vale fechar no caminho)

1. **Seed** do `content.json` → SQLite (script de seed? quando roda?).
2. UX de **token expirado / 401** no front (JWT 24h, sem refresh).
3. Lib de **sanitização de Markdown** (XSS) — não escolhida.
4. **Catálogo de error-codes ↔ i18n** (`auth.emailAlreadyExists` etc.) que `en.json`/`pt.json` cobrem.
5. Alvo de **deploy + CI** (FRD-006, mais pra frente).
6. Confirmar fora de escopo: verificação de e-mail / reset de senha.

## Gotchas / must-knows

- **TDD é obrigatório** (ADR-0005): escreva o teste que falha antes da implementação. Não vale pra
  protótipo visual (FRD-001) nem polish (FRD-004).
- `nestjs-zod`: chamar `patchNestjsSwagger()` pra os DTOs Zod virarem OpenAPI.
- **UUIDv7** (não v4): IDs ordenáveis por tempo → usados direto como cursor de paginação. Precisa de um
  gerador (ex.: pacote `uuidv7`).
- Backend **só devolve error codes** (chaves i18n), nunca texto pro usuário. Acesso cross-user → **404**
  (não 403); **não existe** `permission_error`.
- Sem `expand[]` e sem `Idempotency-Key` (duplo-submit barrado no front via `isPending`).
- Commits: **conventional commits**, **sem `Co-Authored-By`** (regra do projeto/`CLAUDE.md`).

## Estado do git

- Branch `main`. Último commit: **`36d6746`** (docs TDD/E2E) — **local, ainda NÃO pushado**.
- `40b8161` (redesign REST/Stripe/NestJS) já está em `origin/main`.
- Working tree limpo. → **Primeira ação possível: `git push`** do `36d6746`.

## Suggested skills

- **`nestjs-best-practices`** — scaffold do backend Nest (módulos, DI, guards, filters, pipes). Use ao
  montar o item 2/4/5.
- **`database-migration`** — schema Drizzle + 1ª migração (item 3) e, depois, o seed do `content.json`.
- **`github-actions-templates`** — pipeline de CI (lint→type→test→E2E em Docker→build); começa quando o
  harness do item 8 existir.
- **`run`** / **`verify`** — subir o app e confirmar que signup/login funcionam ponta-a-ponta ao fim da fase.
- (Opcional) **`to-issues`** — quebrar a sequência da Fase 0 em issues, se quiser rastrear por ticket.
