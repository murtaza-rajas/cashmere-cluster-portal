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
# Without openssl, `prisma generate` can't detect the libssl version and falls back
# to an openssl-1.1.x engine guess (logged as a warning on every script run in prod).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Must match the builder stage — the Prisma engine copied from there is built for
# the openssl version detected there.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

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
# Plain-JS-only (no ts-node/typescript here, see deps note above) admin scripts meant
# to be run directly in the deployed container, e.g. `docker compose exec api node
# scripts/create-staff-preview-link.js ...`. The .ts scripts alongside these are dev-only
# and never make it into this image.
COPY --from=builder /app/scripts/*.js ./scripts/

# Staff-uploaded images (site hero photos, Stories & Knowledge section images,
# event photos, etc. — see src/common/image-upload.util.ts and every service's
# own uploadImage()) are written to ./uploads at runtime, served back out by
# main.ts's useStaticAssets. This directory is never created by anything above
# (no file ever gets COPYed into it — it only exists once something uploads),
# and /app itself is root-owned from the COPY steps above, so the non-root
# nestjs user below could never create it on first write — confirmed live in
# production (2026-10-04): every upload failed with EACCES: permission denied,
# mkdir '/app/uploads'. Must be writable by nestjs before switching to that
# user. docker-compose.yml mounts a named volume over this same path so
# uploaded files also survive a container rebuild, not just this permission fix.
RUN mkdir -p /app/uploads && chown -R nestjs:nestjs /app/uploads

USER nestjs
EXPOSE 3000

# For local `docker run`/Compose — AWS deployment (ECS target group, ALB) will use
# its own health check config pointing at GET /health, this is just for parity
# when running the image directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]
