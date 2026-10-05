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
    // Runs on every authenticated request — returns null (401, same pattern as
    // StaffJwtStrategy) if the member no longer exists, e.g. a stale cookie
    // outliving a completed GDPR deletion request. findById() uses
    // findUniqueOrThrow, which throws a raw Prisma NotFoundError, not a Nest
    // HttpException — with no global Prisma exception filter anywhere in this
    // app, that error was surfacing as an unhandled 500, not the 401 this
    // comment always claimed. Unreachable until 2026-10-05, when self-service
    // deletion completion became the first thing that actually deletes a
    // Member row outside the never-registered customers/redact webhook —
    // caught live while verifying that fix.
    try {
      return await this.members.findById(payload.sub);
    } catch {
      return null;
    }
  }
}
