# Multi-stage build for the Next.js frontend, using `output: "standalone"`
# (see next.config.ts) — produces a minimal, self-contained runtime image.
# Deliberately generic/portable: no Vercel/Railway/Render-specific base images or
# build steps, so this runs the same in local Docker, ECS/Fargate, or plain EC2.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at container runtime — a docker-compose `environment:` entry alone
# does nothing for this one. Found 2026-09-26 during the first real
# production deploy: the API logout link/etc. baked in as empty because
# nothing passed this through as a build arg. Compose supplies it via
# `build.args` (see docker-compose.yml).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Same class of bug, same fix, for a second variable — found immediately
# after the first (2026-09-26): `next build` also resolves next.config.ts's
# rewrites() once and bakes the result into the standalone server's routing
# manifest, so API_PROXY_TARGET needs to exist at build time too, not just
# at container runtime, or every proxied request silently falls back to
# next.config.ts's own "http://localhost:3000" default — which inside this
# container is itself, not the api service.
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
