# Multi-stage Node 24 build for Fly.io.
# Node 24 is required because `--env-file-if-exists` was added in Node 21
# and we use it in the start script + db:migrate + eval scripts.

# ─── Build stage ────────────────────────────────────────────────────────
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files first for better Docker layer caching — only re-installs
# deps when package.json or package-lock.json changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source + tsconfig and compile
COPY tsconfig.json ./
COPY src ./src
COPY drizzle.config.ts ./
COPY migrations ./migrations
COPY eval ./eval
RUN npm run build

# Prune dev deps for the runtime image
RUN npm prune --production

# ─── Runtime stage ─────────────────────────────────────────────────────
FROM node:24-slim

WORKDIR /app

# Bring over compiled output + production-only node_modules + migrations
# (db:migrate runs at boot via release_command in fly.toml)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/eval ./eval

# Fly.io defaults to 8080 internally; PORT env var lets fly route through it.
EXPOSE 8080

# Start the compiled server. Note: --env-file-if-exists is *intentional* —
# in production Fly.io injects env vars directly, so .env.local won't exist
# (it's gitignored). The flag's "if-exists" semantic means it's a no-op when
# the file is absent.
CMD ["node", "--env-file-if-exists=.env.local", "dist/index.js"]
