import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier } from '@prisma/client';
import { CreateMongoliaStoryDto } from './dto/create-mongolia-story.dto';
import { UpdateMongoliaStoryDto } from './dto/update-mongolia-story.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'mongolia-stories');
const PUBLIC_PREFIX = '/uploads/mongolia-stories';

@Injectable()
export class MongoliaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAllStoriesForStaff() {
    return this.prisma.mongoliaStory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createStory(dto: CreateMongoliaStoryDto, staffUserId: string) {
    const created = await this.prisma.mongoliaStory.create({
      data: {
        title: dto.title,
        excerpt: dto.excerpt,
        body: dto.body,
        category: dto.category,
        foundingOnly: dto.foundingOnly ?? false,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_story.created',
      targetType: 'MongoliaStory',
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  }

  async updateStory(
    id: string,
    dto: UpdateMongoliaStoryDto,
    staffUserId: string,
  ) {
    const existing = await this.findStoryOrThrow(id);

    const updated = await this.prisma.mongoliaStory.update({
      where: { id },
      data: {
        title: dto.title,
        excerpt: dto.excerpt,
        body: dto.body,
        category: dto.category,
        foundingOnly: dto.foundingOnly,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_story.updated',
      targetType: 'MongoliaStory',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async removeStory(id: string, staffUserId: string) {
    const existing = await this.findStoryOrThrow(id);

    await this.prisma.mongoliaStory.delete({ where: { id } });
    if (existing.heroImageUrl) {
      await this.deletePhysicalFile(existing.heroImageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_story.deleted',
      targetType: 'MongoliaStory',
      targetId: id,
      metadata: { title: existing.title },
    });

    return { id };
  }

  // Same write-new-then-delete-old ordering as Event/SiteImage/Design.
  async uploadStoryImage(
    id: string,
    file: Express.Multer.File,
    staffUserId: string,
  ) {
    const existing = await this.findStoryOrThrow(id);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(UPLOAD_DIR, filename), file.buffer);
    const heroImageUrl = `${PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.mongoliaStory.update({
      where: { id },
      data: { heroImageUrl },
    });

    if (existing.heroImageUrl) {
      await this.deletePhysicalFile(existing.heroImageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: existing.heroImageUrl
        ? 'mongolia_story.image_replaced'
        : 'mongolia_story.image_uploaded',
      targetType: 'MongoliaStory',
      targetId: id,
    });

    return updated;
  }

  async removeStoryImage(id: string, staffUserId: string) {
    const existing = await this.findStoryOrThrow(id);
    if (!existing.heroImageUrl) {
      return existing;
    }

    const updated = await this.prisma.mongoliaStory.update({
      where: { id },
      data: { heroImageUrl: null },
    });
    await this.deletePhysicalFile(existing.heroImageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_story.image_removed',
      targetType: 'MongoliaStory',
      targetId: id,
    });

    return updated;
  }

  // Member-facing: active stories visible to this member's real Mongolia
  // level. Newsletter gets non-founding-only stories ("selected stories" per
  // the client's own wording); Founding gets everything. The controller is
  // what actually verifies the caller is a real Mongolia-region member in
  // the first place — this stays a pure query, same split of
  // responsibility as DesignsService.findForMember.
  findStoriesForMember(tier: MembershipTier) {
    return this.prisma.mongoliaStory.findMany({
      where: {
        active: true,
        ...(tier === 'MONGOLIA' ? {} : { foundingOnly: false }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findStoryOrThrow(id: string) {
    const existing = await this.prisma.mongoliaStory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Mongolia story not found');
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
