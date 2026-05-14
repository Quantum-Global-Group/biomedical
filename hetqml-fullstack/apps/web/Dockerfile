# syntax=docker/dockerfile:1
#
# Build context: apps/web/ (set by fly.toml living in the same directory).
#
# Caveat — pnpm lockfile in a monorepo: the workspace lockfile lives at
# /pnpm-lock.yaml (repo root). It's not in the apps/web/ build context, so
# the deps stage falls back to a fresh resolve. Versions are pinned in
# package.json for determinism. If you need the lockfile baked in, set the
# build context to repo root (move fly.toml up + adjust paths).
#
# Use Node 22+ images: Next.js 16 touches the `node:sqlite` built-in during `next build`.

ARG NEXT_PUBLIC_API_URL=http://localhost:8000

FROM node:24-alpine AS deps
WORKDIR /app
# Match monorepo `packageManager` so Corepack does not pull pnpm 11 (blocks
# postinstall for sharp/esbuild without `pnpm approve-builds`).
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml* ./
# Frozen if the lockfile made it in; otherwise resolve fresh against the
# pinned package.json. The `|| pnpm install` mirrors prior behaviour and
# is documented above.
RUN pnpm install --frozen-lockfile || pnpm install

FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
