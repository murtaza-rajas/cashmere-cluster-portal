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
    sameSite: 'lax' as const,
    domain: config.get<string>('COOKIE_DOMAIN'), // e.g. ".cashmerehouse.com" in production
    path: '/',
  };
}

export function sessionCookieSetOptions(config: ConfigService) {
  return { ...sessionCookieOptions(config), maxAge: SESSION_COOKIE_MAX_AGE_MS };
}
