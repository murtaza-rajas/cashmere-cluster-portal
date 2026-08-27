# Cashmere Lovers Club — Application

Phase 1 scaffold. See `/var/www/html/shopify/morten/PROJECT_TRACKER.md` and `CLAUDE.md` (one level up) for full project context, confirmed architecture, and status.

Repo: **https://github.com/murtaza-rajas/cashmere-cluster-portal** (branch `main`).

## Structure

```
app/
  api/                  NestJS backend — Prisma data model, Shopify OAuth login, RBAC, audit log
  web/                  Next.js frontend — the Cashmere Lovers Club member portal UI
  .github/workflows/    CI — api-ci.yml, web-ci.yml
```

## Status

- `api`: NestJS project, Prisma wired in (`PrismaModule`/`PrismaService`), lints clean, builds clean, boots clean, full test suite (unit + e2e) passes against a real database.
- `api/prisma/schema.prisma`: the Phase 1 data model — Member, MemberOrderCache, StaffUser, Role, StaffRoleAssignment, AuditLog, DataSubjectRequest. Read the comments at the top of the file; they explain the design decisions (Shopify as identity source of truth, permanent Founding Member flag, fixed role presets, GDPR data-subject request tracking). **Migrated and verified against a real local Postgres 18.**
- `api/prisma/seed.ts`: seeds the 9 named staff roles from the client's spec + Super Administrator (10 total — note the client's PDF lists 9, not 8 as earlier docs said).
- `api/src/auth/`: Shopify Customer Account API login, OAuth 2.0 + PKCE, built behind a method-agnostic `IdentityProvider` interface. Routes: `GET /auth/shopify/login`, `GET /auth/shopify/callback`. Session is an httpOnly cookie holding our own JWT — the frontend never sees the raw Shopify token or needs to store anything itself. **Verified against real Shopify discovery infrastructure** (correct PKCE + authorization URL construction confirmed), but not yet tested with a real login — that needs the client's actual Shopify client ID and an HTTPS redirect URI (Shopify does not accept `localhost`).
- `api/src/members/`: `MembersService.findOrCreateFromIdentity()` — new members default to the free NEWSLETTER tier; nothing in the auth flow ever grants paid/Founding status (that only happens via the Shopify order webhook in Milestone 4, per the client's "no manual approval, activation on payment" rule).
- `api/src/staff/`: RBAC. `RolesGuard` + `@Roles('Club Manager', ...)` decorator, checked against `StaffRoleAssignment`; Super Administrator bypasses any role list. **`StaffJwtStrategy`/`StaffAuthGuard` are explicitly provisional** — a JWT-in-httpOnly-cookie placeholder (separate secret from member sessions) standing in until the Milestone 1 auth evaluation picks the real staff login method (magic link, Auth0/Cognito, Passkeys). Nothing above that layer changes when it's swapped. **Verified live**: no session → 401, allowed role → 200, disallowed role → 403, Super Administrator → 200 regardless of the route's role list. `scripts/create-test-staff.ts` mints a staff session token for manual testing until real staff login exists.
- `web`: Next.js 16 (App Router, TypeScript, Tailwind) project generated, builds clean. No pages built yet beyond the default scaffold — member portal UI is next.
- `.github/workflows/`: CI for both projects — `api-ci.yml` runs lint, Prisma migrate + seed against a Postgres service container, unit + e2e tests, and build; `web-ci.yml` runs lint + build. Both verified locally before being committed.

## Not done yet

- The real staff login flow — RBAC *authorization* is built (see above), but staff *authentication* is a placeholder.
- No Shopify OAuth end-to-end test with a real store (needs real client ID + staging HTTPS URL — see PROJECT_TRACKER.md Section 11).
- No member portal pages beyond the default Next.js scaffold.
- Offers, Events, Collections, Care & Repair and other Milestone 5 admin entities are intentionally not modelled yet — straightforward additions once Milestone 5 starts, don't block the core foundation.
- No CD/deployment — CI runs on every push, but nothing deploys anywhere yet. Needs a staging hosting decision (client has asked for a staging link to follow progress; see PROJECT_TRACKER.md Section 9).

## Local setup

The `api` needs a local Postgres. No root/Docker required — `embedded-postgres` runs a real Postgres 18 binary under `.dev-postgres-data/` (gitignored).

```bash
cd api
cp .env.example .env   # defaults work for local dev as-is; fill in real Shopify values to test login
npm install

npm run dev:db:start   # leave running in its own terminal (or background it)
npm run prisma:migrate # first time only — creates the schema
npm run prisma:seed    # seeds the 9 roles + Super Administrator

npm run start:dev      # NestJS dev server on :3000
```

When done: `npm run dev:db:stop` in another terminal (or wherever you backgrounded it).

```bash
cd web
npm install
npm run dev             # Next.js dev server on :3001
```

### Testing the Shopify login flow

Requires real values in `.env`: `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, and a `SHOPIFY_REDIRECT_URI` that's registered in the Shopify app's `[customer_authentication]` config **and** publicly reachable over HTTPS (a tunnel like `ngrok`, or a deployed staging URL — Shopify rejects `localhost` redirect URIs outright). Until those exist, `GET /auth/shopify/login` will redirect correctly (this has been verified against real Shopify discovery) but the full round-trip can't be completed.

### Testing the RBAC/staff routes

No real staff login exists yet, so mint a test session token directly:

```bash
npx ts-node scripts/create-test-staff.ts "Club Manager"
# prints a token — use it as the clc_staff_session cookie
curl --cookie "clc_staff_session=<token>" http://localhost:3000/staff/me
```

### A note on the dev Postgres and `tsconfig.build.tsbuildinfo`

If `npm run build` ever produces an empty/stale `dist/`, delete `tsconfig.build.tsbuildinfo` and rebuild — TypeScript's incremental build cache can get out of sync with the actual source tree (this happened once already; the file is gitignored so it shouldn't cause problems for a fresh clone, but worth knowing if it resurfaces).
