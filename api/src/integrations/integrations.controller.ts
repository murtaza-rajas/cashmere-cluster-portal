import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { MailchimpService } from '../mailchimp/mailchimp.service';
import { AuditLogService } from '../audit-log/audit-log.service';

// Technical Administrator, per its seeded role description ("Technical
// operation: integrations, diagnostics and limited settings") — an exact
// match, same pattern as Content Manager/Analytics Viewer for their features.
@Controller('integrations')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Technical Administrator')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly mailchimp: MailchimpService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('status')
  status() {
    return this.integrations.getStatus();
  }

  // Staff-triggered, not an automatic/scheduled sync — see
  // MailchimpService's own comment for why. Creates real Shopify customer
  // records (deliberately a real, visible action a Technical Administrator
  // chooses to run, not something happening silently in the background).
  @Post('mailchimp-sync')
  async mailchimpSync(@Req() req: Request) {
    const result = await this.mailchimp.syncSubscribersToShopify();

    await this.auditLog.log({
      actorStaffUserId: req.staffUser!.id,
      action: 'mailchimp.synced',
      targetType: 'MailchimpSync',
      // No single real entity this action targets (it's a bulk sync) — a
      // fixed sentinel, same convention as ShopifyAdminToken's singleton id.
      targetId: 'mailchimp-sync',
      metadata: {
        totalSubscribers: result.totalSubscribers,
        created: result.created,
        alreadyExisted: result.alreadyExisted,
        failedCount: result.failed.length,
      },
    });

    return result;
  }
}
