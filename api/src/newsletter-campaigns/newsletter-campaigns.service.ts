import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateNewsletterCampaignDto } from './dto/create-newsletter-campaign.dto';
import { UpdateNewsletterCampaignDto } from './dto/update-newsletter-campaign.dto';

@Injectable()
export class NewsletterCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.newsletterCampaign.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async create(dto: CreateNewsletterCampaignDto, staffUserId: string) {
    const created = await this.prisma.newsletterCampaign.create({
      data: {
        subject: dto.subject,
        body: dto.body,
        audienceTiers: dto.audienceTiers,
        audienceRegions: dto.audienceRegions,
        scheduledFor: dto.scheduledFor,
        status: dto.status ?? 'DRAFT',
        createdById: staffUserId,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'newsletter_campaign.created',
      targetType: 'NewsletterCampaign',
      targetId: created.id,
      metadata: { subject: created.subject, status: created.status },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateNewsletterCampaignDto,
    staffUserId: string,
  ) {
    const existing = await this.findOrThrow(id);

    const updated = await this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        subject: dto.subject,
        body: dto.body,
        audienceTiers: dto.audienceTiers,
        audienceRegions: dto.audienceRegions,
        scheduledFor: dto.scheduledFor,
        status: dto.status,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'newsletter_campaign.updated',
      targetType: 'NewsletterCampaign',
      targetId: updated.id,
      metadata: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: string, staffUserId: string) {
    const existing = await this.findOrThrow(id);

    await this.prisma.newsletterCampaign.delete({ where: { id } });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'newsletter_campaign.deleted',
      targetType: 'NewsletterCampaign',
      targetId: id,
      metadata: { subject: existing.subject },
    });

    return { id };
  }

  private async findOrThrow(id: string) {
    const existing = await this.prisma.newsletterCampaign.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Newsletter campaign not found');
    }
    return existing;
  }
}
