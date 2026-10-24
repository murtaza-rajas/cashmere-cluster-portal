import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipTier, Region } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailchimpService } from '../mailchimp/mailchimp.service';
import { CreateNewsletterCampaignDto } from './dto/create-newsletter-campaign.dto';
import { UpdateNewsletterCampaignDto } from './dto/update-newsletter-campaign.dto';

@Injectable()
export class NewsletterCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailchimp: MailchimpService,
  ) {}

  async findAll() {
    const rows = await this.prisma.newsletterCampaign.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((row) => ({
      ...row,
      mailchimpEditUrl: row.mailchimpWebId
        ? this.mailchimp.campaignEditUrl(row.mailchimpWebId)
        : null,
    }));
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

  // Creates the campaign as a draft in Mailchimp (or updates the draft made
  // earlier). Only "Ready to send" campaigns. It goes to the whole Club
  // audience; the intended levels are written into the Mailchimp campaign
  // name so staff can pick a segment there before sending.
  async saveToMailchimp(id: string, staffUserId: string) {
    const campaign = await this.findOrThrow(id);
    if (campaign.status !== 'READY_TO_SEND') {
      throw new BadRequestException(
        'Mark the campaign "Ready to send" before creating it in Mailchimp.',
      );
    }
    if (!campaign.body?.trim()) {
      throw new BadRequestException('The campaign has no text yet.');
    }

    const draft = await this.mailchimp.saveDraftCampaign({
      existingId: campaign.mailchimpCampaignId,
      title: `CLC: ${campaign.subject} (${audienceLabel(campaign.audienceTiers, campaign.audienceRegions)})`,
      subject: campaign.subject,
      html: campaignHtml(campaign.body),
      text: campaign.body,
    });

    const now = new Date();
    const updated = await this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        mailchimpCampaignId: draft.id,
        mailchimpWebId: draft.webId,
        // Same moment for both, so "edited since" only shows after a real edit.
        mailchimpSyncedAt: now,
        updatedAt: now,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: campaign.mailchimpCampaignId
        ? 'newsletter_campaign.mailchimp_updated'
        : 'newsletter_campaign.mailchimp_created',
      targetType: 'NewsletterCampaign',
      targetId: id,
      metadata: { mailchimpCampaignId: draft.id, subject: campaign.subject },
    });

    return { ...updated, mailchimpEditUrl: draft.editUrl };
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

const TIER_LABELS: Record<MembershipTier, string> = {
  NEWSLETTER: 'Newsletter',
  SIX_MONTH: '6-Month',
  ANNUAL: 'Annual',
  FOUNDING: 'Founding',
  MONGOLIA: 'Mongolia',
};

function audienceLabel(tiers: MembershipTier[], regions: Region[]): string {
  const levels = tiers.length
    ? tiers.map((t) => TIER_LABELS[t]).join(', ')
    : 'no levels chosen';
  const sites =
    regions.length === 1
      ? regions[0] === 'MONGOLIA'
        ? ' – Mongolia'
        : ' – International'
      : '';
  return `intended for ${levels}${sites}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The campaign text as simple email HTML: blank lines separate paragraphs,
// single line breaks are kept. Mailchimp adds its own footer/unsubscribe.
export function campaignHtml(body: string): string {
  const paragraphs = body
    .trim()
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#2b2420">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n');
  return `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#faf7f2"><div style="max-width:600px;margin:0 auto">${paragraphs}</div></body></html>`;
}
