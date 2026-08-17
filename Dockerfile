# Stage 1: build the application and prune to production deps
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy manifests first to leverage Docker layer cache
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: the `prepare` hook runs the build, but the source has not
# been copied yet; we build explicitly after COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy the rest of the source and build
COPY . .
RUN pnpm build

# Prune devDeps in-place; the builder stage is discarded, so mutating
# node_modules here is fine and avoids a second install in the runner.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Stage 2: minimal production image (no pnpm, no corepack)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Bring only what the runtime needs: manifest, pruned node_modules, and the
# compiled output. blocks.json is copied into dist/ by the build script
# (copyfiles -u 1 src/blocks.json dist/).
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Drop root; node:22-alpine ships a `node` user (uid 1000).
USER node

# HTTP server listens on PORT (default 3001) at /mcp
EXPOSE 3001

# Liveness: a healthy server replies 400/405 to an uninitialized GET /mcp
# with Accept: text/event-stream (per the MCP Streamable HTTP spec).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/mcp',{method:'GET',headers:{Accept:'text/event-stream'}}).then(r=>process.exit(r.status===400||r.status===405?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/http-server.js"]
