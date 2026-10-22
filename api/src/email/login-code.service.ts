import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from './transactional-email.service';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
const RESEND_COOLDOWN_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const INVALID_CODE =
  "That code isn't right or has expired. Please try again or request a new code.";

export type LoginCodePurpose = 'member' | 'staff';

export interface LoginCodeEmail {
  subject: string;
  text: (code: string) => string;
  html: (code: string) => string;
}

// One-time 6-digit sign-in codes sent by email — shared by member sign-in and
// staff sign-in, kept apart by `purpose`. Callers decide whether the address
// may sign in; a request gets the same treatment either way (a row is stored,
// the limits count it), so the form can't be used to find out who has an
// account.
@Injectable()
export class LoginCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: TransactionalEmailService,
    private readonly config: ConfigService,
  ) {}

  normalize(rawEmail: string): string {
    return rawEmail.trim().toLowerCase();
  }

  // `sendTo` is the address to send to when this email may sign in, or null.
  async issue(params: {
    purpose: LoginCodePurpose;
    email: string;
    ipAddress: string | null;
    sendTo: string | null;
    message: LoginCodeEmail;
  }): Promise<void> {
    const { purpose, email, ipAddress, sendTo, message } = params;
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS);

    const [recentForEmail, recentForIp, latest] = await Promise.all([
      this.prisma.emailLoginCode.count({
        where: { purpose, email, createdAt: { gt: hourAgo } },
      }),
      ipAddress
        ? this.prisma.emailLoginCode.count({
            where: { ipAddress, createdAt: { gt: hourAgo } },
          })
        : Promise.resolve(0),
      this.prisma.emailLoginCode.findFirst({
        where: { purpose, email },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (
      recentForEmail >= MAX_REQUESTS_PER_EMAIL_PER_HOUR ||
      recentForIp >= MAX_REQUESTS_PER_IP_PER_HOUR
    ) {
      throw new HttpException(
        'Too many sign-in attempts. Please wait a while and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (latest && now - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'A code was just sent. Please wait a minute before requesting another.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = sendTo
      ? String(randomInt(0, 1_000_000)).padStart(6, '0')
      : null;

    await this.prisma.emailLoginCode.create({
      data: {
        purpose,
        email,
        codeHash: code ? this.hash(email, code) : '',
        expiresAt: new Date(now + CODE_TTL_MS),
        ipAddress,
      },
    });

    if (sendTo && code) {
      await this.email.send({
        to: sendTo,
        subject: message.subject,
        text: message.text(code),
        html: message.html(code),
      });
    }
  }

  // Checks the latest unused code for this email, counting the attempt.
  // Returns a function that marks the code used — call it only once the
  // caller has confirmed the account may still sign in. Throws
  // INVALID_CODE otherwise.
  async check(
    purpose: LoginCodePurpose,
    email: string,
    rawCode: string,
  ): Promise<() => Promise<void>> {
    const code = rawCode.replace(/\s/g, '');

    const row = await this.prisma.emailLoginCode.findFirst({
      where: {
        purpose,
        email,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || !row.codeHash || row.attempts >= MAX_ATTEMPTS_PER_CODE) {
      throw new BadRequestException(INVALID_CODE);
    }

    await this.prisma.emailLoginCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });

    const expected = Buffer.from(row.codeHash, 'hex');
    const given = Buffer.from(this.hash(email, code), 'hex');
    if (!/^\d{6}$/.test(code) || !timingSafeEqual(expected, given)) {
      throw new BadRequestException(INVALID_CODE);
    }

    return async () => {
      await this.prisma.emailLoginCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
    };
  }

  private hash(email: string, code: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${email}:${code}`)
      .digest('hex');
  }
}

// Shared look of the code email; `title` names who it's for.
export function loginCodeEmailHtml(title: string, code: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Arial,sans-serif;color:#2b2420">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:22px;color:#1c2a45;text-align:center">${title}</td></tr>
<tr><td style="padding-top:20px;font-size:15px;text-align:center">Your sign-in code is</td></tr>
<tr><td style="padding:12px 0;font-size:34px;letter-spacing:8px;font-weight:bold;text-align:center;color:#1c2a45">${code}</td></tr>
<tr><td style="font-size:14px;color:#736a61;text-align:center">Enter it on the sign-in page within 10 minutes.<br>If you didn't ask to sign in, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}
