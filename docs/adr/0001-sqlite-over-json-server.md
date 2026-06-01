# ADR 0001: SQLite in-process instead of JSON Server

- **Status**: Accepted — database engine superseded by ADR 0006 (PostgreSQL)
- **Date**: 2026-05-27
- **Deciders**: David Costa

> **Update (2026-06-01):** the choice to use a *real relational, in-process* DB still
> holds, but the engine moved from SQLite to **PostgreSQL** (with PGlite as the embedded
> in-process engine for dev/test). See ADR 0006.

## Context

The original architecture specified JSON Server as a separate process (localhost:3000), with the NestJS backend making HTTP requests to it. This required three processes during development and added HTTP round-trip latency to every data operation. The repository pattern already abstracts data access, so the underlying storage is swappable.

## Options considered

1. **JSON Server (separate process)** — Simulates a REST API for data. Easy to inspect (plain JSON file), but requires a separate process, adds HTTP overhead, and lacks relational queries, transactions, and constraints.
2. **LowDB (in-process JSON)** — Reads/writes a JSON file directly inside the NestJS process. Eliminates the extra process and HTTP, but still lacks relational features.
3. **SQLite (in-process relational DB)** — Real relational database running in-process. Supports SQL, indexes, foreign keys, transactions. Migration path to PostgreSQL is nearly 1:1.

## Decision

Use **SQLite** running in-process within the NestJS backend.

## Consequences

- **Two processes in dev** instead of three (frontend + backend only).
- **Real relational semantics** — foreign keys, unique constraints, and transactions work from day one.
- **Straightforward PostgreSQL migration** — both speak SQL; the repository pattern isolates the switch to the infrastructure layer.
- **Slightly harder to inspect** than a raw JSON file — requires a SQLite client or CLI instead of a text editor.
- **Need a migration/schema tool** — must decide on an ORM or query builder (TypeORM, Prisma, Drizzle, or raw SQL via better-sqlite3).
