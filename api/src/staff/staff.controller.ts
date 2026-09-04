import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from './guards/staff-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { StaffService } from './staff.service';
import { GrantRoleDto } from './dto/grant-role.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // Any authenticated staff member, no specific role required.
  @UseGuards(StaffAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.staffUser;
  }

  // "Super Administrators create staff accounts" (PDF page 3) — Milestone 5's
  // first real backend piece. Super Administrator only, same as role grants.
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Super Administrator')
  @Get()
  findAll() {
    return this.staffService.findAll();
  }

  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Super Administrator')
  @Post()
  create(@Body() dto: CreateStaffUserDto, @Req() req: Request) {
    return this.staffService.createStaffUser({
      email: dto.email,
      name: dto.name,
      createdById: req.staffUser!.id,
    });
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

  // Role grants are Super Administrator only — deliberately not extended to any
  // other role, unlike members-preview above. Every call is audit-logged
  // (see StaffService.grantRole/revokeRole).
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Super Administrator')
  @Post(':staffUserId/roles')
  grantRole(
    @Param('staffUserId') staffUserId: string,
    @Body() dto: GrantRoleDto,
    @Req() req: Request,
  ) {
    return this.staffService.grantRole({
      staffUserId,
      roleName: dto.roleName,
      dataScope: dto.dataScope,
      grantedById: req.staffUser!.id,
    });
  }

  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Super Administrator')
  @Delete(':staffUserId/roles/:roleName')
  revokeRole(
    @Param('staffUserId') staffUserId: string,
    @Param('roleName') roleName: string,
    @Req() req: Request,
  ) {
    return this.staffService.revokeRole({
      staffUserId,
      roleName,
      revokedById: req.staffUser!.id,
    });
  }
}
