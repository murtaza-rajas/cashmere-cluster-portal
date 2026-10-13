import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier } from '@prisma/client';
import { CreateHomepageUpdateDto } from './dto/create-homepage-update.dto';
import { UpdateHomepageUpdateDto } from './dto/update-homepage-update.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'homepage-updates');
const PUBLIC_PREFIX = '/uploads/homepage-updates';

@Injectable()
export class HomepageUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // "CLC Update" banners (see schema.prisma). Staff see every row, newest first.
  findAllForStaff() {
    return this.prisma.homepageUpdate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { story: { select: { id: true, title: true } } },
    });
  }

  async create(dto: CreateHomepageUpdateDto, staffUserId: string) {
    const created = await this.prisma.homepageUpdate.create({
      data: {
        label: dto.label,
        title: dto.title,
        summary: dto.summary,
        displayDate: dto.displayDate ? new Date(dto.displayDate) : undefined,
        storyId: dto.storyId,
        tiers: dto.tiers,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'homepage_update.created',
      targetType: 'HomepageUpdate',
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateHomepageUpdateDto, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    const updated = await this.prisma.homepageUpdate.update({
      where: { id },
      data: {
        label: dto.label,
        title: dto.title,
        summary: dto.summary,
        displayDate:
          dto.displayDate === null
            ? null
            : dto.displayDate
              ? new Date(dto.displayDate)
              : undefined,
        storyId: dto.storyId,
        tiers: dto.tiers,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'homepage_update.updated',
      targetType: 'HomepageUpdate',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    await this.prisma.homepageUpdate.delete({ where: { id } });
    if (existing.imageUrl) {
      await this.deletePhysicalFile(existing.imageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'homepage_update.deleted',
      targetType: 'HomepageUpdate',
      targetId: id,
      metadata: { title: existing.title },
    });

    return { id };
  }

  // Uploading again replaces the existing photo — same pattern as
  // EventsService.uploadImage: write the new file and commit the DB row
  // before deleting the old physical file.
  async uploadImage(
    id: string,
    file: Express.Multer.File,
    staffUserId: string,
  ) {
    const existing = await this.findOrThrow(id);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(UPLOAD_DIR, filename), file.buffer);
    const imageUrl = `${PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.homepageUpdate.update({
      where: { id },
      data: { imageUrl },
    });

    if (existing.imageUrl) {
      await this.deletePhysicalFile(existing.imageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: existing.imageUrl
        ? 'homepage_update.image_replaced'
        : 'homepage_update.image_uploaded',
      targetType: 'HomepageUpdate',
      targetId: id,
    });

    return updated;
  }

  async removeImage(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);
    if (!existing.imageUrl) {
      return existing;
    }

    const updated = await this.prisma.homepageUpdate.update({
      where: { id },
      data: { imageUrl: null },
    });
    await this.deletePhysicalFile(existing.imageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'homepage_update.image_removed',
      targetType: 'HomepageUpdate',
      targetId: id,
    });

    return updated;
  }

  // Member-facing: the newest active banner for this tier, or null.
  findCurrentForMember(tier: MembershipTier) {
    return this.prisma.homepageUpdate.findFirst({
      where: { active: true, tiers: { has: tier } },
      orderBy: [
        { displayDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        label: true,
        title: true,
        summary: true,
        displayDate: true,
        imageUrl: true,
        storyId: true,
      },
    });
  }

  private async findOrThrow(id: string) {
    const existing = await this.prisma.homepageUpdate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Homepage update not found');
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
