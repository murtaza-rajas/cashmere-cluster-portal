import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SessionJwtPayload } from '../auth.service';
import { MembersService } from '../../members/members.service';

const SESSION_COOKIE = 'clc_session';

function extractFromCookie(req: Request): string | null {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.[SESSION_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly members: MembersService,
  ) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: SessionJwtPayload) {
    // Runs on every authenticated request — throws (401) if the member no longer exists,
    // e.g. after a GDPR deletion request has been completed.
    return this.members.findById(payload.sub);
  }
}
