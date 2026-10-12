import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MembershipTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PAID_TIERS } from '../common/membership-access';

// When a paid membership's end date passes, the member goes back to the free
// Newsletter level (status EXPIRED) — they keep their account, order history
// and, for Founding, the permanent Founding badge (isFoundingMember is never
// touched). A paid tier with no end date (granted by hand) never expires.
// Buying again starts a fresh period (see ShopifyWebhooksService).
//
// Runs daily, and once at startup so a run missed while the server was down
// is caught up.
@Injectable()
export class MembershipExpiryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MembershipExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  onApplicationBootstrap() {
    // Not in tests: e2e specs share one database and start the app many
    // times — they call expireEndedMemberships() directly instead.
    if (process.env.NODE_ENV === 'test') return;
    this.expireEndedMemberships().catch((err: Error) =>
      this.logger.error('Startup membership expiry failed', err),
    );
  }

  @Cron('0 3 * * *', { timeZone: 'Europe/Oslo' })
  async runDaily() {
    await this.expireEndedMemberships();
  }

  async expireEndedMemberships(now = new Date()): Promise<number> {
    const ended = await this.prisma.member.findMany({
      where: {
        membershipTier: { in: PAID_TIERS },
        membershipStatus: 'ACTIVE',
        membershipEndDate: { lt: now },
      },
      select: { id: true, membershipTier: true, membershipEndDate: true },
    });

    for (const member of ended) {
      await this.prisma.member.update({
        where: { id: member.id },
        data: {
          membershipTier: MembershipTier.NEWSLETTER,
          membershipStatus: 'EXPIRED',
        },
      });
      await this.auditLog.log({
        action: 'member.membership_expired',
        targetType: 'Member',
        targetId: member.id,
        targetMemberId: member.id,
        metadata: {
          previousTier: member.membershipTier,
          membershipEndDate: member.membershipEndDate!.toISOString(),
        },
      });
    }

    if (ended.length > 0) {
      this.logger.log(`Expired ${ended.length} membership(s)`);
    }
    return ended.length;
  }
}
