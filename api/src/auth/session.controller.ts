import { Controller, Get, Query, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembersService } from '../members/members.service';
import { SESSION_COOKIE, STAFF_SESSION_COOKIE, sessionCookieOptions } from './session-cookie.util';

// Separate from AuthController (@Controller('auth/shopify')) on purpose — logging
// out just clears our own cookie, it has nothing to do with Shopify specifically.
@Controller('auth')
export class SessionController {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly members: MembersService,
  ) {}

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config));
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(frontendUrl);
  }

  // Separate from member logout — clears the staff session cookie only, never the
  // member one, and redirects back into the staff area rather than the member
  // portal root. See staff-jwt.strategy.ts for why this is a distinct cookie.
  @Get('staff/logout')
  staffLogout(@Res() res: Response) {
    res.clearCookie(STAFF_SESSION_COOKIE, sessionCookieOptions(this.config));
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/staff`);
  }

  // Member-side equivalent of StaffController#previewLogin — same reasoning:
  // a demo member account (e.g. for showing collaborators the Mongolia portal,
  // client request 2026-10-03) needs a one-click way in that doesn't require a
  // real Shopify login. Turns a signed preview token, minted with
  // scripts/create-member-preview-link.js, into a real clc_session cookie.
  // Real members never use this — only ever for demo accounts created
  // specifically for this purpose.
  //
  // Deliberately short-lived (cookie capped well below the normal 30-day member
  // session — see sessionCookieSetOptions) since this reuses the real session
  // cookie: a leaked link should expose a demo account for days, not a month.
  // The token itself is minted with a matching short expiry by the script, so
  // even the raw token stops working on its own once it's past that window.
  @Get('preview-login')
  async previewLogin(@Query('token') token: string, @Res() res: Response) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      await this.members.findById(payload.sub);
    } catch {
      throw new UnauthorizedException(
        'This preview link has expired or is no longer valid — ask for a new one.',
      );
    }
    res.cookie(SESSION_COOKIE, token, {
      ...sessionCookieOptions(this.config),
      maxAge: 72 * 60 * 60 * 1000,
    });
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(frontendUrl);
  }
}
