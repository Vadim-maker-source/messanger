# ════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile для Next.js + Prisma
# ════════════════════════════════════════════════════════════════
# 1. deps     — установка зависимостей с npm ci
# 2. builder  — prisma generate + npm run build
# 3. runner   — финальный slim образ с собранным приложением
# ════════════════════════════════════════════════════════════════

# ─── Stage 1: deps ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Зависимости для нативных модулей prisma и sharp
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# ─── Stage 2: builder ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma: генерим клиент под Linux (musl)
RUN npx prisma generate

# Сборка Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl tini

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Копируем только то что нужно для рантайма
COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next             ./.next
COPY --from=builder /app/node_modules      ./node_modules
COPY --from=builder /app/package.json      ./package.json
COPY --from=builder /app/prisma            ./prisma
COPY --from=builder /app/server.js         ./server.js
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

EXPOSE 3000

# tini — корректный init-процесс, ловит SIGTERM и пробрасывает в Node
ENTRYPOINT ["/sbin/tini", "--"]

# Перед стартом — применяем миграции (idempotent)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
