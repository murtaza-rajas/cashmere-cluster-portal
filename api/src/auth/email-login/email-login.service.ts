import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
import { MailchimpService } from '../../mailchimp/mailchimp.service';
import { ShopifyAdminApiService } from '../../shopify-admin/shopify-admin-api.service';

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

// Shown next to the checkbox on the join form, and stored with each join as
// the record of what the person agreed to.
export const NEWSLETTER_CONSENT_TEXT =
  "Yes, I'd like to receive the Cashmere House newsletter. I can unsubscribe at any time.";

// Email sign-in: a 6-digit code sent to the member's email address. Works for
// every member level, without Shopify or a phone. Codes, limits and sending
// live in LoginCodeService (shared with staff sign-in).
@Injectable()
export class EmailLoginService {
  private readonly logger = new Logger(EmailLoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly codes: LoginCodeService,
    private readonly jwt: JwtService,
    private readonly mailchimp: MailchimpService,
    private readonly shopifyApi: ShopifyAdminApiService,
  ) {}

  // "Join for free" (client request 2026-10-29): someone who isn't a member
  // yet becomes a Newsletter member and gets a sign-in code straight away.
  // They're added to Mailchimp as pending (Mailchimp's confirmation email).
  // If the email already belongs to a member, this just sends a code — same
  // response either way, so the form doesn't reveal who is a member.
  async join(
    dto: { email: string; firstName: string },
    ipAddress: string | null,
  ): Promise<void> {
    const email = this.codes.normalize(dto.email);
    const firstName = dto.firstName.trim();
    // Limits first, so the form can't be used to mass-create accounts.
    await this.codes.assertWithinLimits('member', email, ipAddress);

    const mailchimp = await this.mailchimp
      .addPendingSubscriber({ email: dto.email, firstName })
      .then(() => 'pending' as const)
      .catch((err: Error) => {
        // Joining still works; the consent is recorded below and the
        // Mailchimp sync or staff can follow up.
        this.logger.warn(`Mailchimp add on join failed: ${err.message}`);
        return 'failed' as const;
      });

    let member = await this.findMember(email);
    const created = !member;
    if (!member) {
      let customerId: string;
      try {
        ({ customerId } = await this.shopifyApi.findOrCreateCustomer({
          email: dto.email.trim(),
          firstName,
        }));
      } catch (err) {
        this.logger.error('Shopify customer on join failed', err as Error);
        throw new ServiceUnavailableException(
          "We couldn't create your membership right now — please try again shortly.",
        );
      }
      member =
        (await this.prisma.member.findUnique({
          where: { shopifyCustomerId: customerId },
        })) ??
        (await this.prisma.member.create({
          data: {
            shopifyCustomerId: customerId,
            email: dto.email.trim(),
            firstName,
            membershipTier: MembershipTier.NEWSLETTER,
          },
        }));
    }

    await this.auditLog.log({
      action: 'member.joined',
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
      metadata: {
        memberCreated: created,
        newsletterConsent: NEWSLETTER_CONSENT_TEXT,
        mailchimp,
        ipAddress,
      },
    });

    await this.sendCode(email, ipAddress, member.email);
  }

  async requestCode(rawEmail: string, ipAddress: string | null): Promise<void> {
    const email = this.codes.normalize(rawEmail);
    const member = await this.findMember(email);
    await this.sendCode(email, ipAddress, member?.email ?? null);
  }

  private async sendCode(
    email: string,
    ipAddress: string | null,
    sendTo: string | null,
  ): Promise<void> {
    await this.codes.issue({
      purpose: 'member',
      email,
      ipAddress,
      sendTo,
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
