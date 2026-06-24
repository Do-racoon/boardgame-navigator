FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @boardgame/api build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/ingest/package.json ./packages/ingest/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
