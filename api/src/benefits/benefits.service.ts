import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BenefitType, MembershipTier, Region } from '@prisma/client';
import { CreateBenefitDto } from './dto/create-benefit.dto';
import { UpdateBenefitDto } from './dto/update-benefit.dto';

@Injectable()
export class BenefitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Staff-facing: every row regardless of active/tier, so a draft or
  // currently-inactive row is still visible to edit — only the member-facing
  // side below filters those out. `scopedRegion` (set for a regional role
  // like Mongolia Editor — see region-scope.util.ts) narrows this to rows
  // confined EXACTLY to that region — same exact-match reasoning as
  // EventsService.findAllForStaff, kept consistent with findOrThrow's write
  // check below so the list always matches what's actually editable. null
  // means full, region-unscoped access.
  findAllForStaff(type: BenefitType | undefined, scopedRegion: Region | null) {
    return this.prisma.benefit.findMany({
      where: {
        type,
        ...(scopedRegion ? { regions: { equals: [scopedRegion] } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    dto: CreateBenefitDto,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    // A regionally-scoped staffer (e.g. Mongolia Editor) can only ever
    // create rows confined to their own region — overridden, not merely
    // validated, same reasoning as EventsService.create.
    const regions = scopedRegion ? [scopedRegion] : dto.regions;

    const created = await this.prisma.benefit.create({
      data: {
        type: dto.type,
        tiers: dto.tiers,
        // Undefined (the unscoped case with nothing submitted) omits the
        // field entirely, so Prisma's schema default ([INTERNATIONAL,
        // MONGOLIA]) applies — matches every row created before this field
        // existed.
        regions,
        icon: dto.icon,
        title: dto.title,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'benefit.created',
      targetType: 'Benefit',
      targetId: created.id,
      metadata: { type: created.type, title: created.title },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateBenefitDto,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    const existing = await this.findOrThrow(id, scopedRegion);

    const updated = await this.prisma.benefit.update({
      where: { id },
      data: {
        type: dto.type,
        tiers: dto.tiers,
        regions: scopedRegion ? [scopedRegion] : dto.regions,
        icon: dto.icon,
        title: dto.title,
        description: dto.description,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'benefit.updated',
      targetType: 'Benefit',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(
    id: string,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    const existing = await this.findOrThrow(id, scopedRegion);

    await this.prisma.benefit.delete({ where: { id } });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'benefit.deleted',
      targetType: 'Benefit',
      targetId: id,
      metadata: { type: existing.type, title: existing.title },
    });

    return { id };
  }

  // Same reasoning as EventsService's own findOrThrow — a row visible
  // outside the caller's regional scope is out of bounds even to read for
  // editing, and a real Forbidden rather than a disguised 404.
  private async findOrThrow(id: string, scopedRegion: Region | null) {
    const existing = await this.prisma.benefit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Benefit not found');
    }
    if (
      scopedRegion &&
      (existing.regions.length !== 1 || existing.regions[0] !== scopedRegion)
    ) {
      throw new ForbiddenException(
        'This row is outside your regional scope',
      );
    }
    return existing;
  }

  // Member-facing: only active rows visible to the member's own tier AND
  // region. Takes tier/region directly rather than a memberId — callers
  // (MembersController) already have the authenticated Member row from the
  // session, so this avoids a redundant lookup and keeps this service
  // decoupled from auth. The region check exists specifically because tier
  // alone can't tell a Mongolia Newsletter member apart from an
  // international one — both carry tier NEWSLETTER (see schema.prisma's
  // comment on Benefit.regions).
  findForMember(tier: MembershipTier, region: Region, type: BenefitType) {
    return this.prisma.benefit.findMany({
      where: { type, active: true, tiers: { has: tier }, regions: { has: region } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
