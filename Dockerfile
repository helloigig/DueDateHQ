# Backend image deployed to Fly.io. Frontend deploys to Vercel separately
# (see vercel.json). This image only carries the Node API server.
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS build
WORKDIR /app/backend
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
COPY --from=build /app/backend/migrations ./migrations
COPY backend/package.json ./
EXPOSE 8000
CMD ["node", "dist/index.js"]
