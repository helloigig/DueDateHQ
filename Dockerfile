# Backend image deployed to Fly.io. Frontend deploys to Vercel separately
# (see vercel.json). This image only carries the Node API server.
#
# Node 22-alpine: `--env-file-if-exists` is supported (added in 21.7), so
# the start + migrate scripts can be safely shared between dev (where
# .env.local exists) and prod (where it doesn't).
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS build
WORKDIR /app/backend
# `npm install --include=dev` because NODE_ENV=production from the base
# stage would otherwise drop devDeps (typescript, drizzle-kit) needed by
# `npm run build` and the migrate.ts compile.
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN npm run build

FROM base AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

FROM base
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
# Migrations folder is needed at runtime by the release_command
# (node dist/db/migrate.js → drizzle reads ./migrations/_journal.json +
# the per-version .sql files). Without this COPY the release fails with
# "Can't find meta/_journal.json".
COPY --from=build /app/backend/migrations ./migrations
COPY backend/package.json ./
# EXPOSE is documentation only, but keep it aligned with fly.toml's
# internal_port + the PORT env so we don't drift again.
EXPOSE 8080
CMD ["node", "dist/index.js"]
