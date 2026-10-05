import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { DataSubjectRequestsService } from './data-subject-requests.service';
import { CompleteRequestDto } from './dto/complete-request.dto';

// GDPR request queue for staff — see schema.prisma's DataSubjectRequest comment and
// PROJECT_TRACKER.md Section 4. Shows ACCESS and DELETION requests (self-service,
// see MembersController); EXPORT stays staff/webhook-only. Completing a DELETION
// request here actually erases the member's data — see
// DataSubjectRequestsService#complete for why.
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
