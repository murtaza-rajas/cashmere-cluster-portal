import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { StaffService } from '../staff.service';
import { STAFF_SESSION_COOKIE } from '../../auth/session-cookie.util';

function extractFromCookie(req: Request): string | null {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.[STAFF_SESSION_COOKIE] ?? null;
}

// PROVISIONAL: reuses the same JWT-in-httpOnly-cookie pattern as member auth, signed
// with a *separate* secret (STAFF_JWT_SECRET) so a member session can never be replayed
// as a staff session. This is a placeholder, not a final decision — staff aren't Shopify
// customers, so how they actually log in (magic link, Auth0/Cognito, Passkeys) is exactly
// what the Milestone 1 auth evaluation is for. Nothing above this layer (RolesGuard,
// StaffService) depends on how the JWT was issued, so swapping this out later is a
// contained change: replace this strategy + wherever the JWT gets minted, nothing else.
@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'staff-jwt') {
  constructor(
    config: ConfigService,
    private readonly staff: StaffService,
  ) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('STAFF_JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }) {
    const staffUser = await this.staff.findById(payload.sub);
    if (!staffUser.isActive) {
      return null; // passport-jwt turns a falsy return into a 401
    }
    return staffUser;
  }
}
