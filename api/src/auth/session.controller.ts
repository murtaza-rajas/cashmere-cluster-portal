import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie.util';

// Separate from AuthController (@Controller('auth/shopify')) on purpose — logging
// out just clears our own cookie, it has nothing to do with Shopify specifically.
@Controller('auth')
export class SessionController {
  constructor(private readonly config: ConfigService) {}

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config));
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(frontendUrl);
  }
}
