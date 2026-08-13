# Stage 1: build the application
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

# Stage 2: minimal production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: the `prepare` hook triggers a rebuild, but dist/ is already
# produced in the builder stage and copied below.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Bring only the compiled output; blocks.json is already copied into dist/
# by the build script (copyfiles -u 1 src/blocks.json dist/).
COPY --from=builder /app/dist ./dist

# HTTP server listens on PORT (default 3001) at /mcp
EXPOSE 3001
CMD ["node", "dist/http-server.js"]