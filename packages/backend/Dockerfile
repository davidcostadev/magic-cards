# Built from the repo root context: docker build -f packages/backend/Dockerfile .
# Pure-JS/WASM deps (pg + PGlite) — no native build toolchain needed.
FROM node:22-slim
ENV HUSKY=0
RUN corepack enable
WORKDIR /app

# Install backend deps against the frozen lockfile (needs all workspace manifests).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN pnpm install --frozen-lockfile --filter backend...

COPY packages/backend ./packages/backend
RUN pnpm --filter backend build

WORKDIR /app/packages/backend
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
# main.ts runs Drizzle migrations on boot (migrationsFolder resolves from cwd/src/db).
CMD ["node", "dist/main.js"]
