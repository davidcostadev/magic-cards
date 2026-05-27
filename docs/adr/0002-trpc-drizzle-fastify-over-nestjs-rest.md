# ADR 0002: Fastify + tRPC + Drizzle instead of NestJS + REST

- **Status**: Accepted
- **Date**: 2026-05-27
- **Deciders**: David Costa

## Context

The original architecture specified NestJS with RESTful controllers, class-validator DTOs, and JSON Server. The decision to adopt tRPC for end-to-end type safety and Drizzle as a type-safe query builder (ADR 0001 moved from JSON Server to SQLite) made most of NestJS's value proposition redundant — its controllers, pipes, interceptors, and DTOs are replaced by tRPC routers, middleware, and Zod schemas.

## Options considered

1. **NestJS + tRPC adapter** — Mount tRPC inside NestJS via `trpc-nestjs-adapter`. Keeps NestJS DI but creates a hybrid with two middleware systems and unused NestJS infrastructure.
2. **Fastify + tRPC (standalone)** — Lightweight server, native tRPC adapter, no framework overhead. Clean Architecture maintained as code organization, not framework features.

## Decision

Use **Fastify** as the HTTP server with the **tRPC Fastify adapter**. Use **Drizzle ORM** for database access with **Zod** for input validation.

## Consequences

- **End-to-end type safety** — frontend calls backend procedures with full TypeScript inference, no manual API client code or response types.
- **Zod replaces class-validator** — validation schemas are shared between tRPC input and Drizzle, single source of truth.
- **No DI framework** — dependency injection is manual (constructor/function arguments). Acceptable at this project's scale.
- **Simpler project structure** — no decorators, no modules, no NestJS boilerplate. Clean Architecture layers remain as folder organization.
- **Smaller ecosystem** — fewer off-the-shelf NestJS plugins available. Offset by the simplicity of the stack.
- **Two processes in dev** — frontend (Vite) + backend (Fastify). Down from three in the original design.
