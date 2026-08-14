# syntax=docker/dockerfile:1
# Multi-stage build: compiles the Fastify reverse proxy AND the Next.js
# dashboard, then runs both in one container (suitable for Google Cloud Run).

# ---------------------------------------------------------------------------
# Stage 1 — build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Compile the proxy (TypeScript -> dist/) and build the Next.js dashboard.
RUN npx tsc -p tsconfig.server.json \
 && npm run build

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# App + compiled proxy + built dashboard + node_modules.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.mjs ./

ENV PROXY_PORT=3001
ENV PORT=3000

# Cloud Run routes to $PORT (3000, the dashboard). The proxy runs alongside on
# 3001. Start both; if the proxy exits, the container exits.
EXPOSE 3000 3001
CMD ["sh", "-c", "node dist/server/proxy.js & npx next start -p 3000"]
