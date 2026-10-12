import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CareGuideTopic, MembershipTier } from '@prisma/client';
import { isPaidTier, plainExcerpt } from '../common/membership-access';
import { UpdateCareGuideDto } from './dto/update-care-guide.dto';

@Injectable()
export class CareGuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Staff-facing: all five topics, always — every row is seeded up front
  // (prisma/seed.ts), so this never returns a partial list.
  findAllForStaff() {
    return this.prisma.careGuide.findMany({ orderBy: { topic: 'asc' } });
  }

  async update(
    topic: CareGuideTopic,
    dto: UpdateCareGuideDto,
    staffUserId: string,
  ) {
    const existing = await this.prisma.careGuide.findUnique({
      where: { topic },
    });
    if (!existing) {
      // Shouldn't happen given every topic is pre-seeded, but a real 404 is
      // more honest than a confusing upsert-into-existence if the row was
      // somehow deleted directly in the database.
      throw new NotFoundException('Care guide topic not found');
    }

    // Empty string clears back to the "Guide coming soon" placeholder, same
    // as never having set it — not stored as a distinct "blank but set" state.
    const updated = await this.prisma.careGuide.update({
      where: { topic },
      data: {
        body: dto.body !== undefined ? dto.body || null : undefined,
        updatedById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'care_guide.updated',
      targetType: 'CareGuide',
      targetId: updated.id,
      metadata: {
        topic,
        hadBodyBefore: existing.body !== null,
        hasBodyAfter: updated.body !== null,
      },
    });

    return updated;
  }

  // Member-facing: same five topics, always — the page shows its own
  // "coming soon" placeholder for any topic whose body is still null.
  // Care & Repair is member-only (client request 2026-10-12): other tiers
  // get a short preview of each guide and locked: true — the full guide text
  // is never sent to them, so it can't be read from the API either.
  async findAllForMember(tier: MembershipTier) {
    const guides = await this.prisma.careGuide.findMany({
      orderBy: { topic: 'asc' },
      select: { topic: true, body: true },
    });
    if (isPaidTier(tier)) {
      return guides.map((g) => ({ ...g, preview: null, locked: false }));
    }
    return guides.map((g) => ({
      topic: g.topic,
      body: null,
      preview: g.body ? plainExcerpt(g.body, 140) : null,
      locked: true,
    }));
  }
}
