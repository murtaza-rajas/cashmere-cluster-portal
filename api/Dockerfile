# Multi-stage build for the NestJS backend. Uses node:22-slim (Debian, glibc)
# rather than alpine — Prisma's query engine binaries target glibc by default,
# and slim avoids the extra binaryTargets config alpine's musl libc requires.
# Deliberately generic/portable: no Vercel/Railway/Render-specific base images or
# build steps, so this runs the same in local Docker, ECS/Fargate, or plain EC2.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nestjs \
    && useradd --system --uid 1001 --gid nestjs nestjs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# The Prisma client generated in the builder stage (against dev deps) — copying it
# over means the runner doesn't need `prisma generate` to run again with dev tooling.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nestjs
EXPOSE 3000

# For local `docker run`/Compose — AWS deployment (ECS target group, ALB) will use
# its own health check config pointing at GET /health, this is just for parity
# when running the image directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]
