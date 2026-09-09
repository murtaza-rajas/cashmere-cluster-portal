import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';

// Technical Administrator, per its seeded role description ("Technical
// operation: integrations, diagnostics and limited settings") — an exact
// match, same pattern as Content Manager/Analytics Viewer for their features.
@Controller('integrations')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Technical Administrator')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('status')
  status() {
    return this.integrations.getStatus();
  }
}
