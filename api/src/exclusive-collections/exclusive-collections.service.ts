import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier } from '@prisma/client';
import { CreateExclusiveCollectionDto } from './dto/create-exclusive-collection.dto';
import { UpdateExclusiveCollectionDto } from './dto/update-exclusive-collection.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'exclusive-collections');
const PUBLIC_PREFIX = '/uploads/exclusive-collections';

@Injectable()
export class ExclusiveCollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Staff-facing: every collection regardless of active/tier, same
  // reasoning as EventsService.findAllForStaff — a draft is still visible
  // to edit. International-only feature (no regional scoping) — the
  // member-facing page has no Mongolia equivalent.
  findAllForStaff() {
    return this.prisma.exclusiveCollection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateExclusiveCollectionDto, staffUserId: string) {
    const created = await this.prisma.exclusiveCollection.create({
      data: {
        title: dto.title,
        description: dto.description,
        tiers: dto.tiers,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'exclusive_collection.created',
      targetType: 'ExclusiveCollection',
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateExclusiveCollectionDto, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    const updated = await this.prisma.exclusiveCollection.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        tiers: dto.tiers,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'exclusive_collection.updated',
      targetType: 'ExclusiveCollection',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    await this.prisma.exclusiveCollection.delete({ where: { id } });
    if (existing.imageUrl) {
      await this.deletePhysicalFile(existing.imageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'exclusive_collection.deleted',
      targetType: 'ExclusiveCollection',
      targetId: id,
      metadata: { title: existing.title },
    });

    return { id };
  }

  // Uploading again replaces the existing photo — same pattern as
  // EventsService.uploadImage: write the new file and commit the DB row
  // before deleting the old physical file.
  async uploadImage(id: string, file: Express.Multer.File, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${id}-${randomUUID()}${extname(file.originalname)}`;
    await fs.writeFile(join(UPLOAD_DIR, filename), file.buffer);
    const imageUrl = `${PUBLIC_PREFIX}/${filename}`;

    const updated = await this.prisma.exclusiveCollection.update({
      where: { id },
      data: { imageUrl },
    });

    if (existing.imageUrl) {
      await this.deletePhysicalFile(existing.imageUrl);
    }

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: existing.imageUrl
        ? 'exclusive_collection.image_replaced'
        : 'exclusive_collection.image_uploaded',
      targetType: 'ExclusiveCollection',
      targetId: id,
    });

    return updated;
  }

  async removeImage(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);
    if (!existing.imageUrl) {
      return existing;
    }

    const updated = await this.prisma.exclusiveCollection.update({
      where: { id },
      data: { imageUrl: null },
    });
    await this.deletePhysicalFile(existing.imageUrl);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'exclusive_collection.image_removed',
      targetType: 'ExclusiveCollection',
      targetId: id,
    });

    return updated;
  }

  // Member-facing: only active collections visible to the member's own
  // tier — international-only, no region filter (unlike Event/Benefit).
  findForMember(tier: MembershipTier) {
    return this.prisma.exclusiveCollection.findMany({
      where: { active: true, tiers: { has: tier } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findOrThrow(id: string) {
    const existing = await this.prisma.exclusiveCollection.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Exclusive collection not found');
    }
    return existing;
  }

  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
