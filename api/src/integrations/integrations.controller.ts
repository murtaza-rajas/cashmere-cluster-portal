import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { MailchimpService } from '../mailchimp/mailchimp.service';

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
  ) {}

  @Get('status')
  status() {
    return this.integrations.getStatus();
  }

  // Staff-triggered, not automatic — see MailchimpService. Starts the run and
  // returns 202 immediately; the page polls GET for progress/result.
  @Post('mailchimp-sync')
  @HttpCode(202)
  startMailchimpSync(@Req() req: Request) {
    return this.mailchimp.startSync(req.staffUser!.id).status;
  }

  @Get('mailchimp-sync')
  mailchimpSyncStatus() {
    return this.mailchimp.getSyncStatus();
  }
}
