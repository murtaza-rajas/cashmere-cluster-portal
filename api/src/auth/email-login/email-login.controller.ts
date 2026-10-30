import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { EmailLoginService } from './email-login.service';
import { TransactionalEmailService } from '../../email/transactional-email.service';
import {
  JoinDto,
  RequestEmailCodeDto,
  VerifyEmailCodeDto,
} from './email-login.dto';
import {
  SESSION_COOKIE,
  sessionCookieSetOptions,
} from '../session-cookie.util';
import { clientIp } from '../../common/client-ip';

@Controller('auth/email')
export class EmailLoginController {
  constructor(
    private readonly emailLogin: EmailLoginService,
    private readonly config: ConfigService,
    private readonly emailSender: TransactionalEmailService,
  ) {}

  @Get('status')
  status() {
    return { available: this.emailSender.isConfigured() };
  }

  @Post('request')
  @HttpCode(202)
  async request(@Body() dto: RequestEmailCodeDto, @Req() req: Request) {
    await this.emailLogin.requestCode(dto.email, clientIp(req));
    return {
      message:
        'If this email belongs to a member, a sign-in code is on its way.',
    };
  }

  // "Join for free": becomes a Newsletter member and gets a sign-in code.
  @Post('join')
  @HttpCode(202)
  async join(@Body() dto: JoinDto, @Req() req: Request) {
    await this.emailLogin.join(dto, clientIp(req));
    return {
      message: "Welcome! We've sent a 6-digit sign-in code to your email.",
    };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body() dto: VerifyEmailCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.emailLogin.verifyCode(dto.email, dto.code);
    res.cookie(SESSION_COOKIE, token, sessionCookieSetOptions(this.config));
    return { ok: true };
  }
}
