import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateMembershipLevelDto } from './dto/update-membership-level.dto';

// One fixed row per MembershipTier, seeded once (prisma/seed.ts) — staff can
// only update the existing 4, never create or delete a level. See
// schema.prisma's comment on MembershipLevel for why "access" isn't a field
// here.
const TIER_ORDER: MembershipTier[] = [
  MembershipTier.FOUNDING,
  MembershipTier.ANNUAL,
  MembershipTier.NEWSLETTER,
  MembershipTier.MONGOLIA,
];

@Injectable()
export class MembershipLevelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAllForStaff() {
    const rows = await this.prisma.membershipLevel.findMany();
    return rows.sort(
      (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
    );
  }

  async update(
    tier: MembershipTier,
    dto: UpdateMembershipLevelDto,
    staffUserId: string,
  ) {
    const existing = await this.prisma.membershipLevel.findUnique({
      where: { tier },
    });
    if (!existing) {
      throw new NotFoundException('Membership level not found');
    }

    const updated = await this.prisma.membershipLevel.update({
      where: { tier },
      data: {
        displayName: dto.displayName,
        price: dto.price,
        currency: dto.currency,
        periodLabel: dto.periodLabel,
        benefits: dto.benefits,
        updatedById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'membership_level.updated',
      targetType: 'MembershipLevel',
      targetId: updated.id,
      metadata: { tier, before: existing, after: updated },
    });

    return updated;
  }
}
