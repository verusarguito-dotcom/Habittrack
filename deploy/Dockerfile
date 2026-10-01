# Multi-stage Dockerfile for VibeHabit Monorepo
# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root manifests and workspace configs
COPY package.json package-lock.json tsconfig.base.json tsconfig.json vitest.config.ts ./
COPY packages/shared/package.json packages/shared/tsconfig*.json ./packages/shared/
COPY apps/web/package.json apps/web/tsconfig*.json apps/web/tailwind.config.js ./apps/web/
COPY apps/server/package.json apps/server/tsconfig*.json ./apps/server/

# Install all dependencies including devDependencies for compilation
RUN npm ci

# Copy source code across workspaces
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY apps/server ./apps/server
COPY deploy/migrations ./deploy/migrations

# Compile shared library and build application bundles
RUN npm run build

# Stage 2: Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV HOST=127.0.0.1
ENV PORT=3001
ENV STATIC_DIST_PATH=/app/apps/web/dist
ENV CONTAINER=true

# Install production dependencies only
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

RUN npm ci --omit=dev && npm cache clean --force

# Copy built shared artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Copy web static assets and dist for Fastify static serving
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy server application and database migrations
COPY --from=builder /app/apps/server/src ./apps/server/src
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/deploy/migrations ./deploy/migrations
COPY --from=builder /app/tsconfig.base.json ./

# Ensure node user owns app directory
RUN chown -R node:node /app

# Run as non-root node user for container security
USER node

# Expose internal application port (bound only to 127.0.0.1 by podman-compose)
EXPOSE 3001

# Healthcheck endpoint (loopback only)
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://127.0.0.1:3001/api/v1/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1));"

# Launch Fastify server using Node 22 native TypeScript support
CMD ["node", "--experimental-strip-types", "apps/server/src/index.ts"]
