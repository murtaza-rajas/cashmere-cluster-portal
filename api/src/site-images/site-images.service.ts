import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MembershipTier, SiteImageSlot } from '@prisma/client';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'site-images');
const PUBLIC_PREFIX = '/uploads/site-images';

@Injectable()
export class SiteImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAllForStaff() {
    return this.prisma.siteImage.findMany({
      orderBy: [{ slot: 'asc' }, { tier: 'asc' }],
    });
  }

  // Replaces whatever image already exists for this (slot, tier) — uploading
  // again is how staff change the photo, not a way to add a second one.
  // Writes the new file and the DB row before deleting the old physical file,
  // so a failure partway through never leaves the DB pointing at a file
  // that's already gone.
  async upsert(params: {
    slot: SiteImageSlot;
    tier: MembershipTier;
    file: Express.Multer.File;
    staffUserId: string;
  }) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const existing = await this.prisma.siteImage.findUnique({
      where: { slot_tier: { slot: params.slot, tier: params.tier } },
    });

    const filename = `${params.slot.toLowerCase()}-${params.tier.toLowerCase()}-${randomUUID()}${extname(params.file.originalname)}`;
    await fs.writeFile(join(UPLOAD_DIR, filename), params.file.buffer);
    const url = `${PUBLIC_PREFIX}/${filename}`;

    const saved = await this.prisma.siteImage.upsert({
      where: { slot_tier: { slot: params.slot, tier: params.tier } },
      create: {
        slot: params.slot,
        tier: params.tier,
        url,
        uploadedById: params.staffUserId,
      },
      update: { url, uploadedById: params.staffUserId, uploadedAt: new Date() },
    });

    if (existing) {
      await this.deletePhysicalFile(existing.url);
    }

    await this.auditLog.log({
      actorStaffUserId: params.staffUserId,
      action: existing ? 'site_image.replaced' : 'site_image.uploaded',
      targetType: 'SiteImage',
      targetId: saved.id,
      metadata: { slot: params.slot, tier: params.tier },
    });

    return saved;
  }

  async remove(slot: SiteImageSlot, tier: MembershipTier, staffUserId: string) {
    const existing = await this.prisma.siteImage.findUnique({
      where: { slot_tier: { slot, tier } },
    });
    if (!existing) {
      throw new NotFoundException('No image set for this slot/tier');
    }

    await this.prisma.siteImage.delete({ where: { id: existing.id } });
    await this.deletePhysicalFile(existing.url);

    await this.auditLog.log({
      actorStaffUserId: staffUserId,
      action: 'site_image.removed',
      targetType: 'SiteImage',
      targetId: existing.id,
      metadata: { slot, tier },
    });

    return { slot, tier };
  }

  // Member-facing: a map of just the slots configured for this tier — the
  // frontend falls back to its bundled static default for any slot missing
  // here, so nothing breaks before staff have uploaded anything.
  async findForMember(tier: MembershipTier): Promise<Record<string, string>> {
    const rows = await this.prisma.siteImage.findMany({ where: { tier } });
    return Object.fromEntries(rows.map((r) => [r.slot, r.url]));
  }

  // Best-effort — a missing file on disk (already deleted, moved during a
  // future storage migration, etc.) shouldn't fail the DB operation that
  // triggered the cleanup.
  private async deletePhysicalFile(url: string): Promise<void> {
    const relative = url.startsWith('/') ? url.slice(1) : url;
    await fs.unlink(join(process.cwd(), relative)).catch(() => undefined);
  }
}
