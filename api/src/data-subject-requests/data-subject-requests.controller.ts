import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { DataSubjectRequestsService } from './data-subject-requests.service';
import { CompleteRequestDto } from './dto/complete-request.dto';

// GDPR access/export request queue for staff — see schema.prisma's DataSubjectRequest
// comment and PROJECT_TRACKER.md Section 4. Deletion requests are handled entirely by
// the customers/redact webhook (src/webhooks/) and never land here as a row to action.
@Controller('data-subject-requests')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Member Support')
export class DataSubjectRequestsController {
  constructor(private readonly requests: DataSubjectRequestsService) {}

  @Get('pending')
  pending() {
    return this.requests.findPending();
  }

  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteRequestDto,
    @Req() req: Request,
  ) {
    return this.requests.complete({
      id,
      staffUserId: req.staffUser!.id,
      reason: dto.reason,
    });
  }
}
