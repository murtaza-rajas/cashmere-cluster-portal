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
import { MembershipTier, Region } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'events');
const PUBLIC_PREFIX = '/uploads/events';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Staff-facing: every event regardless of active/tier, same reasoning as
  // BenefitsService.findAllForStaff — a draft or currently-inactive event is
  // still visible to edit. `scopedRegion` (set for a regional role like
  // Mongolia Editor — see region-scope.util.ts) narrows this to rows
  // confined EXACTLY to that region — not merely visible there (a default
  // [INTERNATIONAL, MONGOLIA] row is also "visible" to Mongolia, but it's
  // not Mongolia's to manage). Deliberately the same exact-match condition
  // findOrThrow uses to decide write access, so the list a Mongolia Editor
  // sees always matches what they can actually touch — no "I can see it
  // but not edit it" rows. null means full, region-unscoped access.
  findAllForStaff(scopedRegion: Region | null) {
    return this.prisma.event.findMany({
      where: scopedRegion ? { regions: { equals: [scopedRegion] } } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });
  }

  async create(
    dto: CreateEventDto,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    // A regionally-scoped staffer (e.g. Mongolia Editor) can only ever
    // create rows confined to their own region — whatever `regions` they
    // submitted is overridden, not merely validated, so there's no way to
    // accidentally (or deliberately) create an event visible outside their
    // scope.
    const regions = scopedRegion ? [scopedRegion] : dto.regions;

    const created = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        locationType: dto.locationType,
        location: dto.location,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        registrationUrl: dto.registrationUrl,
        tiers: dto.tiers,
        regions,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'event.created',
      targetType: 'Event',
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    const existing = await this.findOrThrow(id, scopedRegion);

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        locationType: dto.locationType,
        location: dto.location,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        registrationUrl: dto.registrationUrl,
        tiers: dto.tiers,
        // Same override-not-validate reasoning as create() — a scoped
        // staffer can never widen a row's regions beyond their own.
        regions: scopedRegion ? [scopedRegion] : dto.regions,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'event.updated',
      targetType: 'Event',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: string, staffUserId: string, scopedRegion: Region | null) {
    const existing = await this.findOrThrow(id, scopedRegion);

    await this.prisma.event.delete({ where: { id } });
    if (existing.imageUrl) {
      await this.deletePhysicalFile(existing.imageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'event.deleted',
      targetType: 'Event',
      targetId: id,
      metadata: { title: existing.title },
    });

    return { id };
  }

  // Uploading again replaces the existing photo — same pattern as
  // SiteImagesService.upsert: write the new file and commit the DB row
  // before deleting the old physical file, so a failure partway through
  // never leaves the DB pointing at a file that's already gone.
  async uploadImage(
    id: string,
    file: Express.Multer.File,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    const existing = await this.findOrThrow(id, scopedRegion);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(UPLOAD_DIR, filename), file.buffer);
    const imageUrl = `${PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.event.update({
      where: { id },
      data: { imageUrl },
    });

    if (existing.imageUrl) {
      await this.deletePhysicalFile(existing.imageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: existing.imageUrl
        ? 'event.image_replaced'
        : 'event.image_uploaded',
      targetType: 'Event',
      targetId: id,
    });

    return updated;
  }

  async removeImage(
    id: string,
    staffUserId: string,
    scopedRegion: Region | null,
  ) {
    const existing = await this.findOrThrow(id, scopedRegion);
    if (!existing.imageUrl) {
      return existing;
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { imageUrl: null },
    });
    await this.deletePhysicalFile(existing.imageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'event.image_removed',
      targetType: 'Event',
      targetId: id,
    });

    return updated;
  }

  // Member-facing: only active events visible to the member's own tier AND
  // region — same reasoning as BenefitsService.findForMember (tier alone
  // can't tell a Mongolia Newsletter member apart from an international
  // one), ordered by start date since "what's coming up next" is what a
  // member actually wants from this page.
  findForMember(tier: MembershipTier, region: Region) {
    return this.prisma.event.findMany({
      where: { active: true, tiers: { has: tier }, regions: { has: region } },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });
  }

  // `scopedRegion` set means the caller (e.g. Mongolia Editor) may only
  // touch rows confined exactly to that one region — a row also visible
  // internationally (or to some other region) is out of scope even to
  // read for editing, since editing it would affect members outside the
  // caller's remit. A regular NotFoundException would leak whether the id
  // exists at all to someone with no business knowing that, so this is a
  // real Forbidden, not a disguised 404.
  private async findOrThrow(id: string, scopedRegion: Region | null = null) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    if (
      scopedRegion &&
      (existing.regions.length !== 1 || existing.regions[0] !== scopedRegion)
    ) {
      throw new ForbiddenException(
        'This event is outside your regional scope',
      );
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
