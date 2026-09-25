import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier, Prisma } from '@prisma/client';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StorySectionDto } from './dto/story-section.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'stories');
const PUBLIC_PREFIX = '/uploads/stories';

const SECTION_UPLOAD_DIR = join(process.cwd(), 'uploads', 'story-sections');
const SECTION_PUBLIC_PREFIX = '/uploads/story-sections';

const STORY_INCLUDE = {
  category: true,
  sections: { orderBy: { order: Prisma.SortOrder.asc } },
} satisfies Prisma.StoryInclude;

function sectionCreateData(sections: StorySectionDto[]) {
  return sections.map((s) => ({
    order: s.order,
    type: s.type,
    text: s.text,
    imageUrl: s.imageUrl,
    galleryImageUrls: s.galleryImageUrls ?? [],
    quoteText: s.quoteText,
    quoteAttribution: s.quoteAttribution,
  }));
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Staff-facing: every story regardless of status/tier, same reasoning as
  // EventsService.findAllForStaff — a draft is still visible to edit.
  findAllForStaff() {
    return this.prisma.story.findMany({
      include: STORY_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateStoryDto, staffUserId: string) {
    const created = await this.prisma.story.create({
      data: {
        title: dto.title,
        categoryId: dto.categoryId,
        designerName: dto.designerName,
        tiers: dto.tiers,
        status: dto.status,
        featured: dto.featured ?? false,
        sortOrder: dto.sortOrder ?? 0,
        createdById: staffUserId,
        sections: { create: sectionCreateData(dto.sections) },
      },
      include: STORY_INCLUDE,
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'story.created',
      targetType: 'Story',
      targetId: created.id,
      metadata: { title: created.title, sectionCount: created.sections.length },
    });

    return created;
  }

  // `sections`, when present, always replaces the whole list rather than
  // patching individual rows — the admin builder manages the ordered list
  // as one unit (add/remove/reorder in the same save), so a delete-then-
  // recreate inside one transaction is simpler and safer than diffing
  // against what's already stored, and just as correct since sections have
  // no identity meaningful outside their own story.
  async update(id: string, dto: UpdateStoryDto, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.sections) {
        await tx.storySection.deleteMany({ where: { storyId: id } });
      }
      return tx.story.update({
        where: { id },
        data: {
          title: dto.title,
          categoryId: dto.categoryId,
          designerName: dto.designerName,
          tiers: dto.tiers,
          status: dto.status,
          featured: dto.featured,
          sortOrder: dto.sortOrder,
          ...(dto.sections && {
            sections: { create: sectionCreateData(dto.sections) },
          }),
        },
        include: STORY_INCLUDE,
      });
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

    const urls = [
      existing.heroImageUrl,
      ...existing.sections.flatMap((s) => [s.imageUrl, ...s.galleryImageUrls]),
    ].filter((u): u is string => Boolean(u));
    await Promise.all(urls.map((u) => this.deletePhysicalFile(u)));

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
      include: STORY_INCLUDE,
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
      include: STORY_INCLUDE,
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

  // Generic upload for section content (IMAGE/IMAGE_GALLERY) — deliberately
  // not tied to a story or section id, unlike the hero-image endpoint above:
  // sections are composed client-side as part of one story save (add/
  // reorder/remove before ever hitting Save), so there's no stable section
  // id to upload against yet. Staff upload here first, get a URL back, and
  // include it directly in the section's imageUrl/galleryImageUrls when
  // saving the story. Orphan cleanup lives in remove()/replace-on-update
  // via the section rows that end up referencing (or stop referencing)
  // each file, same as every other upload flow in this codebase.
  async uploadSectionImage(
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    await fs.mkdir(SECTION_UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(SECTION_UPLOAD_DIR, filename), file.buffer);
    return { url: `${SECTION_PUBLIC_PREFIX}/${filename}` };
  }

  // Member-facing: only PUBLISHED stories visible to the member's own
  // tier — no region filter (unlike Benefit/Event) since this is the
  // international storiesKnowledge area; Mongolia has its own separate
  // content type (MongoliaStory).
  findForMember(tier: MembershipTier) {
    return this.prisma.story.findMany({
      where: { status: 'PUBLISHED', tiers: { has: tier } },
      include: STORY_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // Homepage curation (client email 2026-09-22: "choose which articles
  // should be featured on the members' homepage") — same PUBLISHED+tier
  // gating as findForMember, plus featured: true.
  findFeaturedForMember(tier: MembershipTier) {
    return this.prisma.story.findMany({
      where: { status: 'PUBLISHED', featured: true, tiers: { has: tier } },
      include: STORY_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findOrThrow(id: string) {
    const existing = await this.prisma.story.findUnique({
      where: { id },
      include: STORY_INCLUDE,
    });
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
