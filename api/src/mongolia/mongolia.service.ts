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
import { MembershipTier } from '@prisma/client';
import { CreateMongoliaStoryDto } from './dto/create-mongolia-story.dto';
import { UpdateMongoliaStoryDto } from './dto/update-mongolia-story.dto';
import { CreateMongoliaProducerDto } from './dto/create-mongolia-producer.dto';
import { UpdateMongoliaProducerDto } from './dto/update-mongolia-producer.dto';
import { SubmitMongoliaPhotoDto } from './dto/submit-mongolia-photo.dto';
import { ReviewMongoliaPhotoDto } from './dto/review-mongolia-photo.dto';

const STORY_UPLOAD_DIR = join(process.cwd(), 'uploads', 'mongolia-stories');
const STORY_PUBLIC_PREFIX = '/uploads/mongolia-stories';
const PRODUCER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'mongolia-producers');
const PRODUCER_PUBLIC_PREFIX = '/uploads/mongolia-producers';
const PHOTO_UPLOAD_DIR = join(process.cwd(), 'uploads', 'mongolia-photos');
const PHOTO_PUBLIC_PREFIX = '/uploads/mongolia-photos';

// Same split as DesignsService's canVote — Mongolia's "selected cases vote"
// tier is Founding (tier MONGOLIA, since region is already the Mongolia
// gate at the controller level — see members.controller.ts).
function canVoteOnProducers(tier: MembershipTier): boolean {
  return tier === 'MONGOLIA';
}

// Submitting photos is a Founding-only capability per the client's
// 2026-09-09 email ("the ability to submit photos/content" is listed
// under Founding Member's full access, not Newsletter's).
function canSubmitPhotos(tier: MembershipTier): boolean {
  return tier === 'MONGOLIA';
}

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

    await fs.mkdir(STORY_UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(STORY_UPLOAD_DIR, filename), file.buffer);
    const heroImageUrl = `${STORY_PUBLIC_PREFIX}/${filename}`;

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

  // Carries real vote counts so the staff "Your Voice / Voting" page can
  // show results — same _count pattern as findProducersForMember, just
  // without the per-member isVoted/canVote fields staff don't need.
  async findAllProducersForStaff() {
    const producers = await this.prisma.mongoliaProducer.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { votes: true } } },
    });
    return producers.map((p) => ({ ...p, voteCount: p._count.votes, _count: undefined }));
  }

  async createProducer(dto: CreateMongoliaProducerDto, staffUserId: string) {
    const created = await this.prisma.mongoliaProducer.create({
      data: {
        name: dto.name,
        craft: dto.craft,
        location: dto.location,
        story: dto.story,
        foundingOnly: dto.foundingOnly ?? false,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_producer.created',
      targetType: 'MongoliaProducer',
      targetId: created.id,
      metadata: { name: created.name },
    });

    return created;
  }

  async updateProducer(
    id: string,
    dto: UpdateMongoliaProducerDto,
    staffUserId: string,
  ) {
    const existing = await this.findProducerOrThrow(id);

    const updated = await this.prisma.mongoliaProducer.update({
      where: { id },
      data: {
        name: dto.name,
        craft: dto.craft,
        location: dto.location,
        story: dto.story,
        foundingOnly: dto.foundingOnly,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_producer.updated',
      targetType: 'MongoliaProducer',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async removeProducer(id: string, staffUserId: string) {
    const existing = await this.findProducerOrThrow(id);

    await this.prisma.mongoliaProducer.delete({ where: { id } });
    if (existing.heroImageUrl) {
      await this.deletePhysicalFile(existing.heroImageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_producer.deleted',
      targetType: 'MongoliaProducer',
      targetId: id,
      metadata: { name: existing.name },
    });

    return { id };
  }

  async uploadProducerImage(
    id: string,
    file: Express.Multer.File,
    staffUserId: string,
  ) {
    const existing = await this.findProducerOrThrow(id);

    await fs.mkdir(PRODUCER_UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(PRODUCER_UPLOAD_DIR, filename), file.buffer);
    const heroImageUrl = `${PRODUCER_PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.mongoliaProducer.update({
      where: { id },
      data: { heroImageUrl },
    });

    if (existing.heroImageUrl) {
      await this.deletePhysicalFile(existing.heroImageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: existing.heroImageUrl
        ? 'mongolia_producer.image_replaced'
        : 'mongolia_producer.image_uploaded',
      targetType: 'MongoliaProducer',
      targetId: id,
    });

    return updated;
  }

  async removeProducerImage(id: string, staffUserId: string) {
    const existing = await this.findProducerOrThrow(id);
    if (!existing.heroImageUrl) {
      return existing;
    }

    const updated = await this.prisma.mongoliaProducer.update({
      where: { id },
      data: { heroImageUrl: null },
    });
    await this.deletePhysicalFile(existing.heroImageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_producer.image_removed',
      targetType: 'MongoliaProducer',
      targetId: id,
    });

    return updated;
  }

  // Same split as findStoriesForMember: Newsletter gets "selected producer
  // content" (non-founding-only), Founding gets "full" producer content.
  // Also carries real vote counts + whether this member has voted — voting
  // is Mongolia Founding-only ("Your voice", per the client's 2026-09-09
  // email and mockup), same canVoteOnProducers() gate enforced in
  // addProducerVote/removeProducerVote below, not just hidden in the UI.
  async findProducersForMember(memberId: string, tier: MembershipTier) {
    const producers = await this.prisma.mongoliaProducer.findMany({
      where: {
        active: true,
        ...(tier === 'MONGOLIA' ? {} : { foundingOnly: false }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { votes: true } },
        votes: { where: { memberId }, select: { id: true } },
      },
    });

    return producers.map((p) => ({
      id: p.id,
      name: p.name,
      craft: p.craft,
      location: p.location,
      story: p.story,
      heroImageUrl: p.heroImageUrl,
      foundingOnly: p.foundingOnly,
      voteCount: p._count.votes,
      isVoted: p.votes.length > 0,
      canVote: canVoteOnProducers(tier),
    }));
  }

  async addProducerVote(producerId: string, memberId: string, tier: MembershipTier) {
    if (!canVoteOnProducers(tier)) {
      throw new ForbiddenException('Voting is available to Mongolia Founding Members only');
    }
    await this.findProducerOrThrow(producerId);
    await this.prisma.mongoliaProducerVote.upsert({
      where: { producerId_memberId: { producerId, memberId } },
      update: {},
      create: { producerId, memberId },
    });
    return { producerId, voted: true };
  }

  async removeProducerVote(producerId: string, memberId: string) {
    await this.prisma.mongoliaProducerVote.deleteMany({ where: { producerId, memberId } });
    return { producerId, voted: false };
  }

  // Photo Archive — member submits (Founding-only, enforced here not just
  // hidden in the UI), staff review before anything goes public. Same
  // write pattern as other image uploads (memoryStorage buffer already
  // filtered to real raster images by imageOnlyFileFilter in the
  // controller), but member-initiated instead of staff-initiated — a first
  // for this app.
  async submitPhoto(
    dto: SubmitMongoliaPhotoDto,
    file: Express.Multer.File,
    memberId: string,
    tier: MembershipTier,
  ) {
    if (!canSubmitPhotos(tier)) {
      throw new ForbiddenException(
        'Submitting photos is available to Mongolia Founding Members only',
      );
    }

    await fs.mkdir(PHOTO_UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(PHOTO_UPLOAD_DIR, filename), file.buffer);
    const imageUrl = `${PHOTO_PUBLIC_PREFIX}/${filename}`;

    const created = await this.prisma.mongoliaPhoto.create({
      data: { imageUrl, caption: dto.caption, submittedById: memberId },
    });

    await this.auditLog.log({
      action: 'mongolia_photo.submitted',
      targetType: 'MongoliaPhoto',
      targetId: created.id,
      metadata: { submittedById: memberId },
    });

    return created;
  }

  // Member-facing: only this member's own submissions, any status — so
  // they can see a pending/rejected photo they sent in, same "I can see my
  // own request's state" principle as DataSubjectRequest.
  findMySubmissions(memberId: string) {
    return this.prisma.mongoliaPhoto.findMany({
      where: { submittedById: memberId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Member-facing: the real, published archive — approved only, split by
  // foundingOnly same as Stories/Producers ("full photo archive" for
  // Founding vs. "selected... images" for Newsletter).
  findApprovedPhotosForMember(tier: MembershipTier) {
    return this.prisma.mongoliaPhoto.findMany({
      where: {
        status: 'APPROVED',
        ...(tier === 'MONGOLIA' ? {} : { foundingOnly: false }),
      },
      orderBy: { reviewedAt: 'desc' },
    });
  }

  // Staff-facing: every submission regardless of status, newest-first so
  // pending ones needing a decision surface naturally — same convention as
  // DataSubjectRequestsService's pending queue.
  findAllPhotosForStaff() {
    return this.prisma.mongoliaPhoto.findMany({
      orderBy: { createdAt: 'desc' },
      include: { submittedBy: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  async reviewPhoto(
    id: string,
    dto: ReviewMongoliaPhotoDto,
    staffUserId: string,
  ) {
    const existing = await this.prisma.mongoliaPhoto.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Photo not found');
    }

    const updated = await this.prisma.mongoliaPhoto.update({
      where: { id },
      data: {
        status: dto.status,
        foundingOnly: dto.status === 'APPROVED' ? (dto.foundingOnly ?? false) : existing.foundingOnly,
        reviewNote: dto.reviewNote,
        reviewedById: staffUserId,
        reviewedAt: new Date(),
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action:
        dto.status === 'APPROVED'
          ? 'mongolia_photo.approved'
          : dto.status === 'REJECTED'
            ? 'mongolia_photo.rejected'
            : 'mongolia_photo.reviewed',
      targetType: 'MongoliaPhoto',
      targetId: id,
    });

    return updated;
  }

  async removePhoto(id: string, staffUserId: string) {
    const existing = await this.prisma.mongoliaPhoto.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Photo not found');
    }

    await this.prisma.mongoliaPhoto.delete({ where: { id } });
    await this.deletePhysicalFile(existing.imageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'mongolia_photo.deleted',
      targetType: 'MongoliaPhoto',
      targetId: id,
    });

    return { id };
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

  private async findProducerOrThrow(id: string) {
    const existing = await this.prisma.mongoliaProducer.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Mongolia producer not found');
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
