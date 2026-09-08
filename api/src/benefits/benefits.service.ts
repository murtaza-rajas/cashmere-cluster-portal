import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BenefitType, MembershipTier } from '@prisma/client';
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
  // side below filters those out.
  findAllForStaff(type?: BenefitType) {
    return this.prisma.benefit.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateBenefitDto, staffUserId: string) {
    const created = await this.prisma.benefit.create({
      data: {
        type: dto.type,
        tiers: dto.tiers,
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

  async update(id: string, dto: UpdateBenefitDto, staffUserId: string) {
    const existing = await this.prisma.benefit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Benefit not found');
    }

    const updated = await this.prisma.benefit.update({
      where: { id },
      data: {
        type: dto.type,
        tiers: dto.tiers,
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

  async remove(id: string, staffUserId: string) {
    const existing = await this.prisma.benefit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Benefit not found');
    }

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

  // Member-facing: only active rows visible to the member's own tier. Takes
  // the tier directly rather than a memberId — callers (MembersController)
  // already have the authenticated Member row from the session, so this
  // avoids a redundant lookup and keeps this service decoupled from auth.
  findForMember(tier: MembershipTier, type: BenefitType) {
    return this.prisma.benefit.findMany({
      where: { type, active: true, tiers: { has: tier } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
