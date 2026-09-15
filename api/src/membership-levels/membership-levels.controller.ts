import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MembershipTier } from '@prisma/client';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { MembershipLevelsService } from './membership-levels.service';
import { UpdateMembershipLevelDto } from './dto/update-membership-level.dto';

// Club Manager, per its seeded description ("Membership operation and
// overall club activity: members, status, benefits, offers, reporting.") —
// an exact match, same role already gating Offers & Benefits and Members &
// Users. Deliberately not /membership-levels — leaves that path free for a
// future member-facing route, matching /event-catalog's precedent.
@Controller('membership-level-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Club Manager')
export class MembershipLevelsController {
  constructor(private readonly membershipLevels: MembershipLevelsService) {}

  @Get()
  findAll() {
    return this.membershipLevels.findAllForStaff();
  }

  @Patch(':tier')
  update(
    @Param('tier', new ParseEnumPipe(MembershipTier)) tier: MembershipTier,
    @Body() dto: UpdateMembershipLevelDto,
    @Req() req: Request,
  ) {
    return this.membershipLevels.update(tier, dto, req.staffUser!.id);
  }
}
