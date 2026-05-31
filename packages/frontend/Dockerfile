# Built from the repo root context: docker build -f packages/frontend/Dockerfile .
FROM node:22-slim
ENV HUSKY=0
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN pnpm install --frozen-lockfile --filter frontend...

COPY packages/frontend ./packages/frontend

# Vite inlines env at build time, so the API base URL must be a build arg.
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter frontend build

WORKDIR /app/packages/frontend
EXPOSE 5000
CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "5000"]
