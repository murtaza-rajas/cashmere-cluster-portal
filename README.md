# Cashmere Lovers Club — Application

Phase 1 scaffold. See `/var/www/html/shopify/morten/PROJECT_TRACKER.md` and `CLAUDE.md` (one level up) for full project context, confirmed architecture, and status.

Repo: **https://github.com/murtaza-rajas/cashmere-cluster-portal** (branch `main`).

## Quick start

**First-time setup:**

```bash
cd api && cp .env.example .env && npm install
cd ../web && cp .env.local.example .env.local && npm install
```

**Every time — 3 terminals:**

```bash
# Terminal 1 — database (leave running)
cd api && npm run dev:db:start

# first time only, in a 4th terminal:
cd api && npx prisma migrate deploy && npm run prisma:seed
```

```bash
# Terminal 2 — API
cd api && npm run start:dev   # → http://localhost:3000
```

```bash
# Terminal 3 — web
cd web && npm run dev         # → http://localhost:3001
```

Open **http://localhost:3001**. Stop with Ctrl+C in terminals 2/3, and `npm run dev:db:stop` (in `api/`) for the database.

**To see the actual dashboard** (real Shopify login isn't wired to real credentials yet):

```bash
cd api && npx ts-node scripts/create-test-member.ts
```

Copy the printed token, set it as a `clc_session` cookie for `localhost` in your browser's DevTools (Application → Cookies), then visit `http://localhost:3001/dashboard`.

See "Local setup" further below for the Docker alternative and more detail.

## Structure

```
app/
  api/                  NestJS backend — Prisma data model, Shopify OAuth login, RBAC, audit log
  web/                  Next.js frontend — the Cashmere Lovers Club member portal UI
  .github/workflows/    CI — api-ci.yml, web-ci.yml
  docker-compose.yml    Local Postgres (+ optional full-stack profile)
```

**Deployment posture:** deliberately platform-agnostic for now — no Vercel/Railway/Render-specific code or config anywhere in this repo. Both `api` and `web` have plain multi-stage Dockerfiles producing portable, generic containers, chosen so this can move to AWS (ECS/Fargate + RDS Postgres) later without a rewrite. Nothing AWS-specific has been added yet either — the containers just don't preclude it.

## Status

- `api`: NestJS project, Prisma wired in (`PrismaModule`/`PrismaService`), lints clean, builds clean, boots clean, full test suite (unit + e2e) passes against a real database.
- `api/prisma/schema.prisma`: the Phase 1 data model — Member, MemberOrderCache, StaffUser, Role, StaffRoleAssignment, AuditLog, DataSubjectRequest. Read the comments at the top of the file; they explain the design decisions (Shopify as identity source of truth, permanent Founding Member flag, fixed role presets, GDPR data-subject request tracking). **Migrated and verified against a real local Postgres 18.**
- `api/prisma/seed.ts`: seeds the 9 named staff roles from the client's spec + Super Administrator (10 total — note the client's PDF lists 9, not 8 as earlier docs said).
- `api/src/auth/`: Shopify Customer Account API login, OAuth 2.0 + PKCE, built behind a method-agnostic `IdentityProvider` interface. Routes: `GET /auth/shopify/login`, `GET /auth/shopify/callback`. Session is an httpOnly cookie holding our own JWT — the frontend never sees the raw Shopify token or needs to store anything itself. **Verified against real Shopify discovery infrastructure** (correct PKCE + authorization URL construction confirmed), but not yet tested with a real login — that needs the client's actual Shopify client ID and an HTTPS redirect URI (Shopify does not accept `localhost`).
- `api/src/members/`: `MembersService.findOrCreateFromIdentity()` — new members default to the free NEWSLETTER tier; nothing in the auth flow ever grants paid/Founding status (that only happens via the Shopify order webhook in Milestone 4, per the client's "no manual approval, activation on payment" rule).
- `api/src/staff/`: RBAC. `RolesGuard` + `@Roles('Club Manager', ...)` decorator, checked against `StaffRoleAssignment`; Super Administrator bypasses any role list. **`StaffJwtStrategy`/`StaffAuthGuard` are explicitly provisional** — a JWT-in-httpOnly-cookie placeholder (separate secret from member sessions) standing in until the Milestone 1 auth evaluation picks the real staff login method (magic link, Auth0/Cognito, Passkeys). Nothing above that layer changes when it's swapped. **Verified live**: no session → 401, allowed role → 200, disallowed role → 403, Super Administrator → 200 regardless of the route's role list. `scripts/create-test-staff.ts` mints a staff session token for manual testing until real staff login exists. Also has `POST`/`DELETE /staff/:staffUserId/roles(/:roleName)` (Super Administrator only) to grant/revoke roles — didn't exist before, added alongside audit logging below.
- `api/src/audit-log/`: `AuditLogService` — every sensitive administrative action is expected to write through this (see the comment at the top of `schema.prisma`). Wired into `MembersService` (`member.created`, once per member) and the new staff role grant/revoke endpoints (`staff.role_granted`/`staff.role_revoked`, with the granting/revoking staff member as actor). **Verified for real**, not just by inspection: `test/audit-log.e2e-spec.ts` runs against a live database, plus manual HTTP verification (403 for a non-Super-Admin, 400 for an invalid request body, 200 on grant/revoke) and a direct query confirming the rows. `DataSubjectRequest` (GDPR export/deletion) still has no write-paths — next thing to build.
- `api/src/main.ts`: global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) — `class-validator`/`class-transformer` were installed from the start but nothing was enforcing DTOs until this was added; every request body was silently accepted as-is before.
- `api/src/health/`: `GET /health`, using `@nestjs/terminus`, checks real database connectivity (not just "the process is alive") — returns 503 with a structured body if the DB is unreachable. Built for AWS ALB/ECS target group health checks later, but works with any orchestrator. **Verified live**: 200 while the DB is reachable, proper 503 the moment it isn't (tested by stopping the DB out from under a running app instance).
- `web`: Next.js 16 (App Router, TypeScript, Tailwind). `output: "standalone"` in `next.config.ts` — verified the standalone build actually boots and serves traffic, not just that `next build` succeeds.
  - `app/page.tsx` + `app/session-status.tsx`: the sign-in entry point. Checks `GET /members/me` on load; shows "Sign in with Shopify" if signed out, redirects to `/dashboard` if already signed in.
  - `app/(member)/`: the actual member portal, route-grouped so every page under it shares one layout. `layout.tsx` does the auth check once (redirects to `/` if no session), provides the member via `MemberContext` (`contexts/member-context.tsx`), and renders the sidebar (`components/sidebar.tsx`) + header (`components/header.tsx`). `dashboard/page.tsx` is the first real page — welcome hero with real data (name, tier, join date, Member ID, Founding status) plus 4 stat cards that honestly show "not tracked yet" rather than invented numbers, since savings/benefits/collection/wishlist all need backend work (Milestone 4/5) that hasn't happened yet. The other sidebar links (Profile, Orders, Wishlist, etc.) exist but 404 — not built yet.
  - `lib/api.ts`: shared fetch helper + formatting utilities (`formatMemberId` builds a placeholder like `CLUB-D084C2` from the UUID — not the client's eventual sequential numbering scheme, which needs a real counter that doesn't exist yet).
  - **Verified in an actual headless browser**, not just by inspection, for all four states: signed-out `/` shows the button with the correct href; signed-in `/` redirects to `/dashboard`; signed-in `/dashboard` renders real data (screenshot, zero console errors); signed-out `/dashboard` redirects back to `/`. `GET /auth/logout` (new) confirmed via curl to actually clear the session cookie. The real Shopify OAuth round-trip itself still can't be completed without real credentials + a public HTTPS URL, but everything downstream of a valid session is proven, not assumed.
- `.github/workflows/`: CI for both projects — `api-ci.yml` runs lint, Prisma migrate + seed against a Postgres service container, unit + e2e tests, and build; `web-ci.yml` runs lint + build. Both verified locally before being committed.
- `api/Dockerfile`, `web/Dockerfile`: multi-stage, portable (node:22-slim / node:22-alpine, no Vercel/Railway/Render base images or build steps). **Not build-tested in this environment — Docker isn't installed in the sandbox this was built in.** Written against the standard, well-documented patterns for NestJS+Prisma and Next.js standalone output, and everything they depend on (the standalone build, the NestJS build, the health endpoint) has been verified working — but run `docker compose --profile full up --build` yourself before trusting these in CI/deployment.

## Not done yet

- The real staff login flow — RBAC *authorization* is built (see above), but staff *authentication* is a placeholder.
- No Shopify OAuth end-to-end test with a real store (needs real client ID + staging HTTPS URL — see PROJECT_TRACKER.md Section 11).
- No member portal pages beyond the login/session-check page — no dashboard, profile, order history, etc. yet (that's the mockup-matching UI work, still to come).
- Offers, Events, Collections, Care & Repair and other Milestone 5 admin entities are intentionally not modelled yet — straightforward additions once Milestone 5 starts, don't block the core foundation.
- No CD/deployment and no hosting decided yet — deliberately kept deployment-agnostic per current direction (Docker images ready, but where they actually run — AWS ECS/Fargate — comes later). CI runs on every push; nothing deploys anywhere yet.
- Dockerfiles are unverified by an actual `docker build` (see Status above) — treat as "should work, needs a real Docker run to confirm" until someone does that.

## Local setup

Two ways to get Postgres running locally — pick one.

**Option A — Docker (recommended, matches how Postgres will actually run everywhere else):**

```bash
cd app   # this directory, the one with docker-compose.yml
docker compose up -d postgres
```

**Option B — no Docker required**, for environments without it (this is how it was developed/tested in this sandbox): `embedded-postgres` runs a real Postgres 18 binary under `api/.dev-postgres-data/` (gitignored).

```bash
cd api
npm run dev:db:start   # leave running in its own terminal (or background it); npm run dev:db:stop when done
```

Either way, then:

```bash
cd api
cp .env.example .env   # defaults work for local dev as-is; fill in real Shopify values to test login
npm install

npm run prisma:migrate # first time only — creates the schema
npm run prisma:seed    # seeds the 9 roles + Super Administrator

npm run start:dev      # NestJS dev server on :3000
```

```bash
cd web
npm install
npm run dev             # Next.js dev server on :3001
```

### Running the built Docker images locally

To validate the actual Dockerfiles (closer to how this runs once deployed, rather than `npm run dev`):

```bash
cd app
docker compose --profile full up --build
```

This builds and runs `api` + `web` + `postgres` together. **Not yet run in this environment** — Docker isn't available in the sandbox this was built in; verify on a machine that has it before relying on this.

### Testing the Shopify login flow

Requires real values in `.env`: `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, and a `SHOPIFY_REDIRECT_URI` that's registered in the Shopify app's `[customer_authentication]` config **and** publicly reachable over HTTPS (a tunnel like `ngrok`, or a deployed staging URL — Shopify rejects `localhost` redirect URIs outright). Until those exist, `GET /auth/shopify/login` will redirect correctly (this has been verified against real Shopify discovery) but the full round-trip can't be completed.

### Testing the RBAC/staff routes

No real staff login exists yet, so mint a test session token directly:

```bash
npx ts-node scripts/create-test-staff.ts "Club Manager"
# prints a token — use it as the clc_staff_session cookie
curl --cookie "clc_staff_session=<token>" http://localhost:3000/staff/me
```

### Testing the member session / frontend login page

Same idea, for the member side — no real Shopify login needed to see the "signed in" state:

```bash
cd api
npx ts-node scripts/create-test-member.ts
# prints a token — set it as clc_session in your browser's devtools (Application > Cookies)
# for http://localhost:3000, or via curl:
curl --cookie "clc_session=<token>" http://localhost:3000/members/me
```

Then set that token as the `clc_session` cookie in your browser (Application → Cookies → `localhost` in devtools) and visit `http://localhost:3001/dashboard` directly, or visit `http://localhost:3001/` and it'll redirect you there automatically since you're signed in.

### Ports

`api` always runs on **3000**, `web` is pinned to **3001** (`next dev -p 3001` in `package.json`) regardless of which one you start first — earlier this wasn't pinned, so starting `web` before `api` could let it grab port 3000 and cause a confusing `EADDRINUSE` when `api` started. Fixed; if you're on an old checkout, `git pull`.

### `Cannot find module dist/main` (fixed, but here's why in case anything similar resurfaces)

This used to happen intermittently on `npm run start:dev`/`npm run build`: TypeScript's `incremental` compilation writes a `tsconfig.build.tsbuildinfo` cache, but Nest's `nest-cli.json` has `deleteOutDir: true`, which deletes `dist/` *outside* of tsc's knowledge. The incremental cache would then believe nothing changed and skip re-emitting files that had just been deleted — `nest build` would report "0 errors" while `dist/main.js` silently didn't exist. Reproduced it on demand and fixed the root cause: `incremental` is now off in `tsconfig.json`, so no `.tsbuildinfo` is generated at all and this class of bug is structurally impossible. If you still have an old `tsconfig.build.tsbuildinfo` sitting around from before this fix, delete it once — it's gitignored so it won't come back.
