import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from './guards/staff-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('staff')
export class StaffController {
  // Any authenticated staff member, no specific role required.
  @UseGuards(StaffAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.staffUser;
  }

  // Reference implementation for how future admin routes (Members & Users, etc.)
  // should be protected: StaffAuthGuard first (who are you), RolesGuard second
  // (are you allowed here). Super Administrator always passes regardless of the
  // roles listed — see StaffService.hasAnyRole.
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Club Manager', 'Member Support')
  @Get('members-preview')
  membersPreview() {
    return {
      note: 'Placeholder — real Members & Users admin endpoints come in Milestone 5.',
    };
  }
}
