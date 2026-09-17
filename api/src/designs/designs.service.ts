import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier, DesignStatus } from '@prisma/client';
import { CreateDesignDto } from './dto/create-design.dto';
import { UpdateDesignDto } from './dto/update-design.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'designs');
const PUBLIC_PREFIX = '/uploads/designs';

export type DesignImageSlot = 'hero' | 'swatch' | 'sketch';
const IMAGE_FIELD: Record<
  DesignImageSlot,
  'heroImageUrl' | 'swatchImageUrl' | 'sketchImageUrl'
> = {
  hero: 'heroImageUrl',
  swatch: 'swatchImageUrl',
  sketch: 'sketchImageUrl',
};

// Design Lab tier access, confirmed directly from the three real tier-
// homepage mockups (see schema.prisma's comment on the Design model) — kept
// here, not in web/lib/access.ts, since these gates must hold even if a
// request bypasses the frontend entirely.
function canView(tier: MembershipTier): boolean {
  return tier === 'FOUNDING' || tier === 'ANNUAL';
}
// Client email 2026-09-17, exact words: voting/saving stays open through
// CURRENT and SELECTED_FOR_DEVELOPMENT ("this will allow us to continue
// measuring member interest while the design is being developed"), and
// "once the design moves to Coming to Production, the voting stage can be
// closed" — so voting closes for every tier, not just non-Founding, once a
// design reaches SELECTED_FOR_PRODUCTION (or is archived to PAST_ROUND).
// Saving/favoriting is never gated by status, only by canView's tier check.
const VOTABLE_STATUSES: DesignStatus[] = [
  DesignStatus.CURRENT,
  DesignStatus.SELECTED_FOR_DEVELOPMENT,
];
function canVote(tier: MembershipTier, status: DesignStatus): boolean {
  return tier === 'FOUNDING' && VOTABLE_STATUSES.includes(status);
}

@Injectable()
export class DesignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAllForStaff() {
    return this.prisma.design.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateDesignDto, staffUserId: string) {
    const created = await this.prisma.design.create({
      data: {
        title: dto.title,
        description: dto.description,
        round: dto.round,
        status: dto.status,
        tags: dto.tags ?? [],
        designerName: dto.designerName,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'design.created',
      targetType: 'Design',
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateDesignDto, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    const updated = await this.prisma.design.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        round: dto.round,
        status: dto.status,
        tags: dto.tags,
        designerName: dto.designerName,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'design.updated',
      targetType: 'Design',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    await this.prisma.design.delete({ where: { id } });
    for (const url of [
      existing.heroImageUrl,
      existing.swatchImageUrl,
      existing.sketchImageUrl,
    ]) {
      if (url) await this.deletePhysicalFile(url);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'design.deleted',
      targetType: 'Design',
      targetId: id,
      metadata: { title: existing.title },
    });

    return { id };
  }

  // Same write-new-then-delete-old ordering as Event/SiteImage — a failure
  // partway through never leaves the DB pointing at a deleted file.
  async uploadImage(
    id: string,
    slot: DesignImageSlot,
    file: Express.Multer.File,
    staffUserId: string,
  ) {
    const existing = await this.findOrThrow(id);
    const field = IMAGE_FIELD[slot];
    const previousUrl = existing[field];

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${slot}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(UPLOAD_DIR, filename), file.buffer);
    const url = `${PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.design.update({
      where: { id },
      data: { [field]: url },
    });

    if (previousUrl) {
      await this.deletePhysicalFile(previousUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: previousUrl ? 'design.image_replaced' : 'design.image_uploaded',
      targetType: 'Design',
      targetId: id,
      metadata: { slot },
    });

    return updated;
  }

  async removeImage(id: string, slot: DesignImageSlot, staffUserId: string) {
    const existing = await this.findOrThrow(id);
    const field = IMAGE_FIELD[slot];
    const url = existing[field];
    if (!url) return existing;

    const updated = await this.prisma.design.update({
      where: { id },
      data: { [field]: null },
    });
    await this.deletePhysicalFile(url);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'design.image_removed',
      targetType: 'Design',
      targetId: id,
      metadata: { slot },
    });

    return updated;
  }

  // Member-facing: every active design (all statuses — the member portal
  // splits Current/Selected for Production/Past Rounds/Your Favourites as
  // tabs over one fetched list, matching the mockup's own tab structure,
  // rather than four separate endpoints), with real favorite/vote counts and
  // whether *this* member has favorited/voted each one. Returns an empty
  // list for a tier with no access — the controller is what actually blocks
  // the request; this stays a pure query.
  async findForMember(memberId: string, tier: MembershipTier) {
    if (!canView(tier)) {
      return [];
    }

    const designs = await this.prisma.design.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { favorites: true, votes: true } },
        favorites: { where: { memberId }, select: { id: true } },
        votes: { where: { memberId }, select: { id: true } },
      },
    });

    return designs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      round: d.round,
      status: d.status,
      tags: d.tags,
      designerName: d.designerName,
      heroImageUrl: d.heroImageUrl,
      swatchImageUrl: d.swatchImageUrl,
      sketchImageUrl: d.sketchImageUrl,
      favoriteCount: d._count.favorites,
      voteCount: d._count.votes,
      isFavorited: d.favorites.length > 0,
      isVoted: d.votes.length > 0,
      canVote: canVote(tier, d.status),
    }));
  }

  async addFavorite(designId: string, memberId: string, tier: MembershipTier) {
    if (!canView(tier)) {
      throw new ForbiddenException(
        'Design Lab is not available on your membership level',
      );
    }
    await this.findOrThrow(designId);
    await this.prisma.designFavorite.upsert({
      where: { designId_memberId: { designId, memberId } },
      update: {},
      create: { designId, memberId },
    });
    return { designId, favorited: true };
  }

  async removeFavorite(designId: string, memberId: string) {
    await this.prisma.designFavorite.deleteMany({
      where: { designId, memberId },
    });
    return { designId, favorited: false };
  }

  async addVote(designId: string, memberId: string, tier: MembershipTier) {
    const design = await this.findOrThrow(designId);
    if (!canVote(tier, design.status)) {
      throw new ForbiddenException(
        design.status === DesignStatus.CURRENT ||
          design.status === DesignStatus.SELECTED_FOR_DEVELOPMENT
          ? 'Voting is available to Founding Members only'
          : 'Voting has closed for this design',
      );
    }
    await this.prisma.designVote.upsert({
      where: { designId_memberId: { designId, memberId } },
      update: {},
      create: { designId, memberId },
    });
    return { designId, voted: true };
  }

  // Same closed-round reasoning as addVote — a member shouldn't be able to
  // change their vote after voting has closed either, even though removing
  // one is less consequential than adding one. Tier isn't checked here
  // (unlike addVote): if a vote somehow exists, whoever cast it should
  // always be able to retract it while voting is still open, regardless of
  // how the tier rule might read for a fresh vote.
  async removeVote(designId: string, memberId: string) {
    const design = await this.findOrThrow(designId);
    if (
      design.status !== DesignStatus.CURRENT &&
      design.status !== DesignStatus.SELECTED_FOR_DEVELOPMENT
    ) {
      throw new ForbiddenException('Voting has closed for this design');
    }
    await this.prisma.designVote.deleteMany({ where: { designId, memberId } });
    return { designId, voted: false };
  }

  private async findOrThrow(id: string) {
    const existing = await this.prisma.design.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Design not found');
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
