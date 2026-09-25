import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateStoryCategoryDto } from './dto/create-story-category.dto';

@Injectable()
export class StoryCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.storyCategory.findMany({ orderBy: { name: 'asc' } });
  }

  // Super Administrator only (enforced in the controller, not here) — every
  // other role that edits stories can only select from this list, never add
  // to it, per the client's own instruction (2026-09-24 email).
  async create(dto: CreateStoryCategoryDto, staffUserId: string) {
    const existing = await this.prisma.storyCategory.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }

    const created = await this.prisma.storyCategory.create({
      data: { name: dto.name },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'story_category.created',
      targetType: 'StoryCategory',
      targetId: created.id,
      metadata: { name: created.name },
    });

    return created;
  }
}
