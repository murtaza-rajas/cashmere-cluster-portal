import { ConfigService } from '@nestjs/config';

export const SESSION_COOKIE = 'clc_session';
const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Shared between auth.controller.ts (sets this cookie) and session.controller.ts
// (clears it) — clearCookie only actually clears a cookie if path/domain match
// exactly what it was set with, so this exists to keep both call sites from
// drifting out of sync with each other.
export function sessionCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    secure: true,
    // 'lax' is correct (and safer) once frontend/backend share a parent domain in
    // production (see COOKIE_DOMAIN below) — the frontend's API calls are then
    // same-site. Only override to 'none' for a dev setup where they're on genuinely
    // different domains (e.g. two separate ngrok tunnels), where Lax would silently
    // block the cookie on cross-site fetch/XHR calls.
    sameSite: (config.get<string>('SESSION_COOKIE_SAMESITE') ?? 'lax') as 'lax' | 'none',
    domain: config.get<string>('COOKIE_DOMAIN'), // e.g. ".cashmerehouse.com" in production
    path: '/',
  };
}

export function sessionCookieSetOptions(config: ConfigService) {
  return { ...sessionCookieOptions(config), maxAge: SESSION_COOKIE_MAX_AGE_MS };
}
