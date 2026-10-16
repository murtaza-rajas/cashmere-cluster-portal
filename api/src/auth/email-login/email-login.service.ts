import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { Member, MembershipTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TransactionalEmailService } from '../../email/transactional-email.service';
import { DEMO_ID_PREFIX } from '../../common/membership-access';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
const RESEND_COOLDOWN_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const INVALID_CODE =
  "That code isn't right or has expired. Please try again or request a new code.";

// If one email address belongs to several members (rare), sign into the one
// with the highest level.
const TIER_RANK: Record<MembershipTier, number> = {
  NEWSLETTER: 0,
  MONGOLIA: 1,
  SIX_MONTH: 2,
  ANNUAL: 3,
  FOUNDING: 4,
};

// Email sign-in: a 6-digit code sent to the member's email address. Works for
// every member level, without Shopify or a phone. Requests get the same
// response whether or not the address belongs to a member, and the limits
// apply equally, so the form can't be used to find out who is a member.
@Injectable()
export class EmailLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly email: TransactionalEmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestCode(rawEmail: string, ipAddress: string | null): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS);

    const [recentForEmail, recentForIp, latest] = await Promise.all([
      this.prisma.emailLoginCode.count({
        where: { email, createdAt: { gt: hourAgo } },
      }),
      ipAddress
        ? this.prisma.emailLoginCode.count({
            where: { ipAddress, createdAt: { gt: hourAgo } },
          })
        : Promise.resolve(0),
      this.prisma.emailLoginCode.findFirst({
        where: { email },
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

    const member = await this.findMember(email);
    const code = member
      ? String(randomInt(0, 1_000_000)).padStart(6, '0')
      : null;

    // A row is stored for every request (empty hash for non-members) so the
    // rate limits above treat all addresses the same.
    await this.prisma.emailLoginCode.create({
      data: {
        email,
        codeHash: code ? this.hash(email, code) : '',
        expiresAt: new Date(now + CODE_TTL_MS),
        ipAddress,
      },
    });

    if (member && code) {
      await this.email.send({
        to: member.email,
        subject: "Your Cashmere Lovers' Club sign-in code",
        text: `Your sign-in code is ${code}\n\nEnter it on the sign-in page within 10 minutes.\n\nIf you didn't ask to sign in, you can ignore this email.\n\nCashmere Lovers' Club`,
        html: signInEmailHtml(code),
      });
    }
  }

  // Returns a session token for the member on success.
  async verifyCode(rawEmail: string, rawCode: string): Promise<string> {
    const email = rawEmail.trim().toLowerCase();
    const code = rawCode.replace(/\s/g, '');

    const row = await this.prisma.emailLoginCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
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

    const member = await this.findMember(email);
    if (!member) throw new BadRequestException(INVALID_CODE);

    await this.prisma.emailLoginCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    await this.auditLog.log({
      action: 'member.signed_in_email',
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
    });

    return this.jwt.signAsync({ sub: member.id });
  }

  private async findMember(email: string): Promise<Member | null> {
    const members = await this.prisma.member.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        NOT: { shopifyCustomerId: { startsWith: DEMO_ID_PREFIX } },
      },
    });
    return (
      members.sort(
        (a, b) =>
          TIER_RANK[b.membershipTier] - TIER_RANK[a.membershipTier] ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null
    );
  }

  private hash(email: string, code: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${email}:${code}`)
      .digest('hex');
  }
}

function signInEmailHtml(code: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Arial,sans-serif;color:#2b2420">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:22px;color:#1c2a45;text-align:center">Cashmere Lovers' Club</td></tr>
<tr><td style="padding-top:20px;font-size:15px;text-align:center">Your sign-in code is</td></tr>
<tr><td style="padding:12px 0;font-size:34px;letter-spacing:8px;font-weight:bold;text-align:center;color:#1c2a45">${code}</td></tr>
<tr><td style="font-size:14px;color:#736a61;text-align:center">Enter it on the sign-in page within 10 minutes.<br>If you didn't ask to sign in, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}
