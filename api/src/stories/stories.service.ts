import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier } from '@prisma/client';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'stories');
const PUBLIC_PREFIX = '/uploads/stories';

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Staff-facing: every story regardless of active/tier, same reasoning as
  // EventsService.findAllForStaff — a draft is still visible to edit.
  findAllForStaff() {
    return this.prisma.story.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateStoryDto, staffUserId: string) {
    const created = await this.prisma.story.create({
      data: {
        title: dto.title,
        body: dto.body,
        quote: dto.quote,
        category: dto.category,
        tiers: dto.tiers,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'story.created',
      targetType: 'Story',
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateStoryDto, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    const updated = await this.prisma.story.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        quote: dto.quote,
        category: dto.category,
        tiers: dto.tiers,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'story.updated',
      targetType: 'Story',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    await this.prisma.story.delete({ where: { id } });
    if (existing.heroImageUrl) {
      await this.deletePhysicalFile(existing.heroImageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'story.deleted',
      targetType: 'Story',
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
    const heroImageUrl = `${PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.story.update({
      where: { id },
      data: { heroImageUrl },
    });

    if (existing.heroImageUrl) {
      await this.deletePhysicalFile(existing.heroImageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: existing.heroImageUrl
        ? 'story.image_replaced'
        : 'story.image_uploaded',
      targetType: 'Story',
      targetId: id,
    });

    return updated;
  }

  async removeImage(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);
    if (!existing.heroImageUrl) {
      return existing;
    }

    const updated = await this.prisma.story.update({
      where: { id },
      data: { heroImageUrl: null },
    });
    await this.deletePhysicalFile(existing.heroImageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'story.image_removed',
      targetType: 'Story',
      targetId: id,
    });

    return updated;
  }

  // Member-facing: only active stories visible to the member's own tier —
  // no region filter (unlike Benefit/Event) since this is the international
  // storiesKnowledge area; Mongolia has its own separate content type
  // (MongoliaStory).
  findForMember(tier: MembershipTier) {
    return this.prisma.story.findMany({
      where: { active: true, tiers: { has: tier } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findOrThrow(id: string) {
    const existing = await this.prisma.story.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Story not found');
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
