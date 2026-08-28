# Authentication Method Evaluation — Passkeys, OTP, 2FA, SMS

**Milestone 1 deliverable.** Client asked for an evaluation of passwordless authentication options (Passkeys/FIDO2/WebAuthn, one-time codes, 2FA, SMS fallback) before Phase 1 development, with an explicit instruction not to lock Phase 1 into traditional passwords. This document is that evaluation. See `PROJECT_TRACKER.md` Section 3 for the client's original request and the decision already made from it.

## Decision already made, restated here for completeness

For Phase 1, Cashmere Lovers Club members log in via **Shopify Customer Accounts (OAuth 2.0 + PKCE)** — see `app/api/src/auth/providers/shopify-identity.provider.ts`. This was confirmed by the client and is implemented and verified (see `PROJECT_TRACKER.md` Section 12). Nothing in this document changes that decision — it's the evaluation the client asked to see the reasoning behind, and the forward-looking plan for the options not chosen yet.

## Why the current approach already satisfies most of the ask

Two things worth understanding about how the Shopify integration actually works, because they directly answer most of what a "passwordless evaluation" would otherwise need to justify from scratch:

1. **Shopify's Customer Accounts are passwordless by default.** Members sign in with a one-time code sent to their email — there's no password to set, store, or forget. DCC not storing member passwords is already true today, not something Phase 2 needs to add.

2. **We never render our own login form.** `GET /auth/shopify/login` redirects the browser to Shopify's own hosted `authorization_endpoint` (discovered via `.well-known/openid-configuration` — see the code). The login screen the member actually sees, and every authentication method offered on it, is entirely Shopify's, not ours. This matters for Passkeys specifically: **if Shopify enables Passkey/WebAuthn sign-in on that hosted page, our members get it automatically, with zero code changes on our side.** We don't need to build or maintain Passkey support ourselves for the Cashmere Lovers Club login — we inherit whatever Shopify ships there, for free, because of this architectural choice (OAuth redirect vs. embedded custom login form).

## Option-by-option evaluation

### Passkeys / FIDO2 / WebAuthn

**What it is:** Public-key cryptography-based sign-in — a device-bound credential (Face ID, fingerprint, Windows Hello, or a hardware key) replaces a password entirely. Phishing-resistant, no shared secret to leak.

**Status on Shopify's platform:** Shopify has shipped Passkey support on its own consumer-facing surfaces — the Shop app and Shop Pay checkout — using WebAuthn (confirmed via Shopify's own engineering blog). What's **not publicly confirmed** is whether that same Passkey option is currently offered on the Customer Account API's hosted OAuth login page specifically (the exact surface our `/auth/shopify/login` redirects to) — Shopify's public documentation describes the Shop app/Shop Pay rollout in detail but doesn't explicitly state Customer Account API OAuth login parity. This needs a live check once we have real store credentials (Milestone 2 next step), not something safe to assert with certainty from documentation alone.

**Recommendation:** No action needed from us for the Cashmere Lovers Club login — per the point above, this rides on Shopify's own rollout automatically. Track it (a quick manual check against the real store once credentials exist), but don't build anything.

**Where we *do* need to decide on Passkeys directly:** the future Producer/Designer/Brand/Retail/Investor portals, where users aren't Shopify customers and we'll be choosing our own identity provider (see below).

### One-time codes (email OTP)

**What it is:** What Shopify Customer Accounts already uses today. Already in production in our integration.

**Recommendation:** Current default, no change needed.

### Two-factor authentication (2FA)

**What it is:** A second factor (TOTP app, SMS code) layered on top of a primary login method.

**Relevance to Phase 1:** Not applicable to members — Shopify's own account security (including any 2FA Shopify offers its customers) is Shopify's responsibility, not ours, since we never see or store their credentials. **Relevant to staff/admin accounts** — the data model already has `StaffUser.mfaEnabled` as a field for this (see `schema.prisma`), anticipating it, but no 2FA is implemented yet since staff authentication itself is still a provisional placeholder (see `PROJECT_TRACKER.md` Section 12). Recommend requiring 2FA for staff accounts, especially Super Administrator and Investor Relations Manager roles, once real staff auth is built.

### SMS (as a fallback/recovery method)

**What it is:** A code sent via SMS, typically used as account-recovery fallback when a primary passwordless method is unavailable.

**Relevance to Phase 1:** Not needed for members — Shopify's own account recovery flow handles this if a member loses access to their email, and that's Shopify's responsibility, not ours. Could be relevant later for staff account recovery, but that's downstream of deciding the real staff identity provider.

## Recommendation for future non-Shopify portals (Producer/Designer/Brand/Retail/Investor + staff accounts)

These users aren't Shopify customers, so we do need to choose and integrate a real identity provider — currently a placeholder (`StaffJwtStrategy`, explicitly provisional, see code comments). When that decision is made:

- **Prefer a provider with native Passkey/WebAuthn support** — both Auth0 and AWS Cognito support this today, so choosing either means Passkeys are available to staff/partner accounts with configuration, not custom cryptographic implementation work.
- Keep using the existing `IdentityProvider` interface pattern (`app/api/src/auth/interfaces/identity-provider.interface.ts`) — this was built specifically so a new provider (for staff, or a Passkey-first flow) plugs in without touching `MembersService`, `AuthService`, or the RBAC layer at all.

## Summary table

| Method | Members (Phase 1) | Staff (future) |
|---|---|---|
| One-time email code | ✅ In production today (via Shopify) | Candidate for interim staff login |
| Passkeys/WebAuthn | Inherited automatically if/when Shopify enables it on Customer Account API login — needs live verification, no action required from us | Recommended default once a real identity provider (Auth0/Cognito) is chosen |
| 2FA | Not our responsibility (Shopify-side) | Recommended for Super Admin/Investor Relations roles; schema already anticipates it |
| SMS fallback | Not our responsibility (Shopify-side) | Possible recovery method, decide alongside identity provider choice |

## Conclusion

Phase 1's architecture already satisfies the client's core requirement — no passwords stored by DCC, and no lock-in to a specific method, since authentication is fully delegated to Shopify's own hosted login for members and built behind a swappable interface for everything else. No further action is needed for Phase 1 beyond a live check of Shopify's current Customer Account API capabilities once real credentials exist. The one concrete decision still open is which identity provider to use for staff/future-portal users — recommend Auth0 or Cognito specifically for their native Passkey support, to be decided when Milestone 5 (or earlier, if staff admin work starts sooner) requires real staff login.
