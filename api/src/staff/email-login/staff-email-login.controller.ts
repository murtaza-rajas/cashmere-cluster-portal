import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { StaffEmailLoginService } from './staff-email-login.service';
import {
  RequestEmailCodeDto,
  VerifyEmailCodeDto,
} from '../../auth/email-login/email-login.dto';
import {
  STAFF_SESSION_COOKIE,
  sessionCookieOptions,
} from '../../auth/session-cookie.util';
import { clientIp } from '../../common/client-ip';

const STAFF_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // matches the 12h token

// Under /auth (not /staff) so the web app's existing /auth/* proxy rule
// reaches it — /staff/* paths collide with the Admin's own pages.
@Controller('auth/staff-email')
export class StaffEmailLoginController {
  constructor(
    private readonly staffEmailLogin: StaffEmailLoginService,
    private readonly config: ConfigService,
  ) {}

  @Post('request')
  @HttpCode(202)
  async request(@Body() dto: RequestEmailCodeDto, @Req() req: Request) {
    await this.staffEmailLogin.requestCode(dto.email, clientIp(req));
    return {
      message:
        'If this email belongs to a staff account, a sign-in code is on its way.',
    };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body() dto: VerifyEmailCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.staffEmailLogin.verifyCode(dto.email, dto.code);
    res.cookie(STAFF_SESSION_COOKIE, token, {
      ...sessionCookieOptions(this.config),
      maxAge: STAFF_SESSION_MAX_AGE_MS,
    });
    return { ok: true };
  }
}
