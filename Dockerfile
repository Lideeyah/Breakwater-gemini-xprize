# syntax=docker/dockerfile:1
# Single-origin container for Google Cloud Run. The Fastify reverse proxy is the
# front door on $PORT: it serves the agent API + WebSocket telemetry directly and
# proxies everything else to an internal Next.js dashboard. One HTTPS URL, one
# port — exactly what Cloud Run exposes.

# ---------------------------------------------------------------------------
# Stage 1 — build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Next.js SWC needs libc6-compat on Alpine.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
# npm install (not ci): npm ci hard-fails on cross-platform lockfile quirks with
# native-fallback packages (@emnapi/*) when building Linux from a macOS lockfile.
RUN npm install --no-audit --no-fund

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

# Single-origin mode: Fastify fronts the internal Next server on 3000.
ENV SERVE_DASHBOARD=1
ENV NEXT_INTERNAL_PORT=3000
# GEMINI_API_KEY is provided at deploy time (gcloud run deploy --set-env-vars).
# Cloud Run injects $PORT (defaults to 8080); the proxy binds it as the front door.
EXPOSE 8080

# Start the internal Next dashboard, give it a moment, then run the proxy in the
# foreground so the container's lifecycle follows the front door.
CMD ["sh", "-c", "npx next start -p ${NEXT_INTERNAL_PORT:-3000} & sleep 3 && node dist/server/proxy.js"]
