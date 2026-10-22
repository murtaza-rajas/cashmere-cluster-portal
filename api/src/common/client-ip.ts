import type { Request } from 'express';

// Behind Caddy, which replaces any client-sent X-Forwarded-For with the real
// client address before the Next.js proxy appends its own — so the first
// entry is the visitor and can't be spoofed.
export function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  return first || req.ip || null;
}
