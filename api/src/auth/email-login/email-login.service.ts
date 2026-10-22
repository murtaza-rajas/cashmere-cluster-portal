import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Member, MembershipTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  INVALID_CODE,
  LoginCodeService,
  loginCodeEmailHtml,
} from '../../email/login-code.service';
import { DEMO_ID_PREFIX } from '../../common/membership-access';

// If one email address belongs to several members (rare), sign into the one
// with the highest level.
const TIER_RANK: Record<MembershipTier, number> = {
  NEWSLETTER: 0,
  MONGOLIA: 1,
  SIX_MONTH: 2,
  ANNUAL: 3,
  FOUNDING: 4,
};

const CLUB_NAME = "Cashmere Lovers' Club";

// Email sign-in: a 6-digit code sent to the member's email address. Works for
// every member level, without Shopify or a phone. Codes, limits and sending
// live in LoginCodeService (shared with staff sign-in).
@Injectable()
export class EmailLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly codes: LoginCodeService,
    private readonly jwt: JwtService,
  ) {}

  async requestCode(rawEmail: string, ipAddress: string | null): Promise<void> {
    const email = this.codes.normalize(rawEmail);
    const member = await this.findMember(email);
    await this.codes.issue({
      purpose: 'member',
      email,
      ipAddress,
      sendTo: member?.email ?? null,
      message: {
        subject: `Your ${CLUB_NAME} sign-in code`,
        text: (code) =>
          `Your sign-in code is ${code}\n\nEnter it on the sign-in page within 10 minutes.\n\nIf you didn't ask to sign in, you can ignore this email.\n\n${CLUB_NAME}`,
        html: (code) => loginCodeEmailHtml(CLUB_NAME, code),
      },
    });
  }

  // Returns a session token for the member on success.
  async verifyCode(rawEmail: string, rawCode: string): Promise<string> {
    const email = this.codes.normalize(rawEmail);
    const markUsed = await this.codes.check('member', email, rawCode);

    const member = await this.findMember(email);
    if (!member) throw new BadRequestException(INVALID_CODE);

    await markUsed();
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
}
