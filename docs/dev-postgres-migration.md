# Plano: migrar o banco de **dev** do PGlite para Postgres real

> **Status: EXECUTADO (2026-06-05).** Em vez do Docker Compose das §1/§3, apontamos o dev para um
> **Postgres já em execução** em `localhost:5437` (servidor que também hospeda o app Eats2Seats). Para
> isolar, criamos uma **base dedicada `magic_cards`** nesse servidor (`CREATE DATABASE magic_cards`,
> role `root`/superuser) — sem misturar com `eats2seats_dev` (que tem `users` e ~70 tabelas). As
> migrações `0000–0006` aplicaram limpas via `pnpm --filter backend db:migrate`. `DATABASE_URL` no
> `.env` = `postgresql://root:123asd@localhost:5437/magic_cards`. **Sem `docker-compose.dev.yml` e sem
> scripts `db:up`/`db:down`/`predev`** (o servidor já roda de forma independente). Restante do plano
> (§5 dados, §6 PGlite fallback, §7 docs) seguido. Backup pré-migração: tag git
> `pre-postgres-migration-20260605T054846` + `~/backups/magic-cards/backend-data-*.tar.gz`.
>
> Escopo: ambiente de **desenvolvimento local** apenas. Produção/E2E já usam Postgres real (`pg`); os
> testes continuam em PGlite **em memória** e **não mudam**.

## Contexto / por que

O dev local usa **PGlite** (Postgres embarcado em WASM, no próprio processo Node, persistido em
`packages/backend/data/pg`). Ele **corrompe de forma recorrente** (há vários `data/pg.corrupt-*`).

Causa raiz (não é Drizzle, nem migração):

- PGlite só garante os dados em disco quando o `client.close()` **assíncrono** termina
  (`db/client.ts:112` → `database.module.ts:34` → `app.factory.ts:15`).
- `nest start --watch` derruba e sobe o processo a cada alteração. Se o processo morre antes do
  flush terminar — ou se há overlap de dois processos no mesmo diretório (o lock de dev é só
  *advisory*, ver `db/client.ts:27-33`) — o diretório fica inconsistente e o próximo open **aborta**
  (`Aborted()`), antes de qualquer SQL.

Postgres real roda como **servidor separado**: a persistência é dele, não do processo Node. Reiniciar
/ matar / hot-reload do backend **não corrompe** nada. Isso elimina a classe inteira do problema.

## O que já está pronto no código (a mudança é pequena)

| Já suporta | Onde |
|---|---|
| Driver `pg` quando `DATABASE_URL` está setado | `packages/backend/src/db/client.ts:73-78` |
| `pnpm dev` migra via node-postgres quando há `DATABASE_URL` | `packages/backend/src/db/migrate.mjs:98-100` (`migrateUrl`) |
| Migração canônica para Postgres real | script `db:migrate` = `drizzle-kit migrate` + `drizzle.config.ts` |
| `DATABASE_URL` opcional no schema de env (vale em dev também) | `packages/backend/src/config/env.ts:12` |
| Imagem/credenciais de Postgres de referência | `docker-compose.e2e.yml` (postgres:17-alpine) |

Ou seja: basta **subir um Postgres local** e **apontar `DATABASE_URL`** para ele.

## Plano

### 1. Postgres local via Docker Compose (novo arquivo `docker-compose.dev.yml`)
Serviço só de banco, com **volume nomeado** (persiste entre `up/down`) e porta exposta no host:

```yaml
# docker-compose.dev.yml — Postgres para desenvolvimento local
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: magic_cards
    ports:
      - "5432:5432"
    volumes:
      - magic_cards_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d magic_cards"]
      interval: 2s
      timeout: 3s
      retries: 20
volumes:
  magic_cards_pgdata:
```

> WSL2: `localhost:5432` funciona normalmente. Se a porta 5432 estiver ocupada por um Postgres do
> sistema, mapear `"5433:5432"` e ajustar a URL.

### 2. Apontar o dev para o Postgres
- Em `packages/backend/.env`, definir (descomentar) a connection string:
  ```
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/magic_cards
  ```
- Atualizar o comentário do `.env.example` para deixar claro que **dev agora usa Postgres via Docker**
  (PGlite vira apenas fallback se `DATABASE_URL` ficar vazio).

### 3. Scripts para subir/derrubar o banco (root `package.json`)
```jsonc
"db:up":   "docker compose -f docker-compose.dev.yml up -d --wait",
"db:down": "docker compose -f docker-compose.dev.yml down",
"db:logs": "docker compose -f docker-compose.dev.yml logs -f postgres",
"predev":  "docker compose -f docker-compose.dev.yml up -d --wait"
```
`predev` garante o banco no ar antes do `pnpm dev` (o `up -d --wait` bloqueia até o healthcheck passar,
evitando o backend tentar migrar antes do Postgres aceitar conexões). Alternativa sem `predev`: rodar
`pnpm db:up` manualmente uma vez por sessão.

### 4. Migrações
Com `DATABASE_URL` setado, o fluxo já existente migra o Postgres real:
- `pnpm dev` → `migrate.mjs` detecta a URL e roda `drizzle-kit`-equivalente via node-postgres
  (transacional), depois sobe o nest. **Sem `db:migrate:dev`/`db:repair`** (esses são só do PGlite).
- Caminho canônico/CI: `pnpm --filter backend db:migrate` (`drizzle-kit migrate`).
- Aplicar `pgcrypto`/extensões: **não é necessário** (ids são UUIDv7 gerados na app, timestamps em texto).

### 5. Dados de dev
- Os dados do PGlite corrompido **não são recuperáveis** — começa-se com um banco limpo.
- Recarregar conteúdo compartilhado: `POST /v1/catalog/import` (`docs/content-catalog.md §4b`) com um
  JSON de `{ subjects, cards }`. Recriar a conta de teste via signup.
- Opcional: adicionar um script de seed dedicado (fora do escopo mínimo).

### 6. PGlite: manter como fallback, marcar como tal
- **Manter** o branch PGlite em `client.ts` (fallback quando `DATABASE_URL` vazio) e a **dependência
  `@electric-sql/pglite`** — os **testes dependem dela** (`createTestDatabase`, in-memory).
- Marcar `db:migrate:dev` e `db:repair` como **PGlite-only / legado** no `package.json` e na doc.
- Opcional: mover `packages/backend/data/` (todas as `pg*`) para fora do caminho ou apagar os
  `data/pg.corrupt-*` antigos depois de confirmar que tudo funciona.

### 7. Documentação
- `CLAUDE.md` (seção *Dev Servers* / *Common Commands*): trocar a narrativa "PGlite zero-setup" por
  "Postgres via `pnpm db:up`"; remover a nota de `db:migrate:dev`/`db:repair` do fluxo padrão.
- `docs/PROJECT_STATUS.md §6` e **ADR 0006**: registrar que **dev passou a usar Postgres real**
  (PGlite fica para testes em memória e como fallback). Vale um adendo curto à ADR 0006.

## Verificação

1. `pnpm db:up` → `docker compose ps` mostra `postgres` *healthy*.
2. `pnpm --filter backend db:migrate` → todas as migrações (até `0006`) aplicam sem erro.
3. `pnpm dev` → backend sobe em `:3001` (`/docs` responde), frontend em `:5173`.
4. **Teste anti-corrupção** (o objetivo): com o app rodando, editar um arquivo do backend várias vezes
   (forçando hot-reloads) e dar `Ctrl-C`/`kill` algumas vezes; reiniciar — o banco **continua abrindo
   normalmente** (sem `Aborted()`). Isso reproduz exatamente o cenário que corrompia o PGlite.
5. Fluxo funcional: signup → criar assunto/cards → estudar → reportar card → filtro "Reportados".
6. `pnpm test` (backend + frontend) continua verde — usa PGlite em memória, independente do Docker.

## Rollback

Reverter é trivial: **esvaziar/remover `DATABASE_URL`** do `.env` → o app volta a usar PGlite. Para
descartar o Postgres local: `pnpm db:down -v` (remove o volume `magic_cards_pgdata`).

## Decisões em aberto (confirmar antes de executar)

- **Porta**: `5432` (padrão) ou `5433` se houver conflito local?
- **Persistência**: volume nomeado (recomendado) vs. efêmero (apaga ao `down`)?
- **`predev` automático** (sobe o Docker junto do `pnpm dev`) vs. `pnpm db:up` manual?
- **PGlite**: manter como fallback (recomendado, testes dependem) — confirmado, não remover a dep.
- **Seed**: criar script de seed/import agora ou recriar dados à mão?

## Arquivos afetados

- **Novos**: `docker-compose.dev.yml`.
- **Modificados**: `package.json` (root, scripts `db:up`/`db:down`/`db:logs`/`predev`),
  `packages/backend/.env` (+ `.env.example`), `CLAUDE.md`, `docs/PROJECT_STATUS.md`,
  `docs/adr/0006-*.md` (adendo). Sem mudança em código de aplicação (o suporte a `pg` já existe).
