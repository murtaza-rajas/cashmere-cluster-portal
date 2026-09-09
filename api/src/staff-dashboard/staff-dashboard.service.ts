import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Aggregates real data across Members, MemberOrderCache and
// DataSubjectRequest for the staff Dashboard landing page (client's
// "1.1 ADMIN.png" sketch). Deliberately does NOT surface anything for
// Design Lab, Stories & News, or a "pending approval" queue on
// Offers/Events/Site Images — none of those exist as real, queryable
// concepts in the schema (Design Lab and Stories aren't built at all;
// Offers/Events/Site Images are direct-apply, no draft/approval state).
// The frontend shows those honestly (disabled "coming soon" cards / an
// omitted task row) rather than this service inventing fake numbers for
// them.
@Injectable()
export class StaffDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Real member counts (total + per-tier), each with a "vs last month"
  // delta computed against the count as of the start of the current
  // calendar month — same month-boundary definition getGrowth() uses, so
  // the stat cards and the growth chart never disagree with each other.
  // A tier with zero members at the start of this month has no baseline to
  // divide by — delta is null (rendered as "—" by the frontend) rather than
  // a fabricated 0% or a divide-by-zero Infinity.
  async getStats() {
    const members = await this.prisma.member.findMany({
      select: { createdAt: true, membershipTier: true },
    });
    const startOfThisMonth = startOfMonthOffset(new Date(), 0);

    const current = groupByTier(members);
    const prior = groupByTier(
      members.filter((m) => m.createdAt < startOfThisMonth),
    );

    const tiers: Array<keyof typeof current.byTier> = [
      'FOUNDING',
      'ANNUAL',
      'NEWSLETTER',
      'MONGOLIA',
    ];

    return {
      total: {
        count: current.total,
        deltaPercent: percentDelta(current.total, prior.total),
      },
      byTier: Object.fromEntries(
        tiers.map((tier) => [
          tier,
          {
            count: current.byTier[tier] ?? 0,
            deltaPercent: percentDelta(
              current.byTier[tier] ?? 0,
              prior.byTier[tier] ?? 0,
            ),
          },
        ]),
      ),
    };
  }

  // Cumulative member count (total + per-tier) as of the end of each of the
  // last `months` calendar months, oldest first — a real running total, not
  // "new signups in that month" (that's ReportsService.getNewMembersByPeriod,
  // a different question). Fetches the whole {createdAt, tier} column pair
  // once (small dataset) and buckets in JS, same approach as the rest of
  // this session's reporting code.
  async getGrowth(months: number) {
    const now = new Date();
    const boundaries = Array.from({ length: months }, (_, i) =>
      startOfMonthOffset(now, months - 1 - i),
    );
    const members = await this.prisma.member.findMany({
      select: { createdAt: true, membershipTier: true },
    });

    return boundaries.map((periodStart, idx) => {
      // Cumulative "through end of this month" = everyone created before the
      // *next* bucket starts; for the most recent bucket (this month, still
      // in progress) that upper bound is "now", not a future month start.
      const upperBound =
        idx < boundaries.length - 1 ? boundaries[idx + 1] : now;
      const grouped = groupByTier(
        members.filter((m) => m.createdAt < upperBound),
      );
      return {
        periodStart: periodStart.toISOString(),
        total: grouped.total,
        byTier: grouped.byTier,
      };
    });
  }

  async getRecentMembers(limit: number) {
    const members = await this.prisma.member.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        membershipTier: true,
        // No "country" field exists on Member — region (International vs.
        // Mongolia) is the real, closest equivalent, not a fabricated one.
        region: true,
        membershipStatus: true,
        createdAt: true,
      },
    });
    return members.map((m) => ({
      id: m.id,
      name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
      tier: m.membershipTier,
      region: m.region,
      status: m.membershipStatus,
      joinedAt: m.createdAt,
    }));
  }

  // Merges two real event sources (new members, new orders) into one
  // timestamp-sorted feed. Deliberately doesn't include "design received
  // from DCC" / "vote in Design Lab" / "story published" style entries from
  // the sketch — none of those are real events this system can produce yet.
  async getRecentActivity(limit: number) {
    const [members, orders] = await Promise.all([
      this.prisma.member.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          firstName: true,
          lastName: true,
          email: true,
          membershipTier: true,
          createdAt: true,
        },
      }),
      this.prisma.memberOrderCache.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          orderNumber: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
      }),
    ]);

    const items = [
      ...members.map((m) => ({
        type: 'member_joined' as const,
        message: `New member registered — ${[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email} (${m.membershipTier})`,
        timestamp: m.createdAt,
      })),
      ...orders.map((o) => ({
        type: 'order_received' as const,
        message: `New order ${o.orderNumber} — ${o.totalAmount.toString()} ${o.currency}`,
        timestamp: o.createdAt,
      })),
    ];

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, limit);
  }

  // Only the one real "pending, needs staff action" concept that exists
  // today. Extensible shape — more keys join this as other admin areas grow
  // a real draft/approval state, not before.
  async getPendingTasks() {
    const gdprRequestsPending = await this.prisma.dataSubjectRequest.count({
      where: { status: 'PENDING' },
    });
    return { gdprRequestsPending };
  }
}

function startOfMonthOffset(now: Date, monthsAgo: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1),
  );
}

function groupByTier(members: { membershipTier: string }[]) {
  const byTier: Record<string, number> = {};
  for (const m of members) {
    byTier[m.membershipTier] = (byTier[m.membershipTier] ?? 0) + 1;
  }
  return { total: members.length, byTier };
}

function percentDelta(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}
