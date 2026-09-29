import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StaffAuthGuard } from './guards/staff-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { StaffService } from './staff.service';
import { GrantRoleDto } from './dto/grant-role.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { STAFF_SESSION_COOKIE, sessionCookieOptions } from '../auth/session-cookie.util';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // TEMPORARY convenience standing in for real staff login (see staff-jwt.strategy.ts —
  // this is a placeholder until the Milestone 1 auth evaluation picks magic
  // link/Auth0/Passkeys). Turns a signed preview token, minted with
  // scripts/create-staff-preview-link.ts, into a real clc_staff_session cookie via a
  // single click on a URL someone was sent — no devtools/curl/cookie editing needed.
  // Only works for a token signed with STAFF_JWT_SECRET, so it can't be forged, and it
  // stops working the moment the token's own expiry passes. Remove once real staff
  // login exists.
  @Get('preview-login')
  async previewLogin(@Query('token') token: string, @Res() res: Response) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const staffUser = await this.staffService.findById(payload.sub);
      if (!staffUser.isActive) {
        throw new Error('inactive');
      }
    } catch {
      throw new UnauthorizedException(
        'This preview link has expired or is no longer valid — ask for a new one.',
      );
    }
    res.cookie(STAFF_SESSION_COOKIE, token, {
      ...sessionCookieOptions(this.config),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/staff`);
  }

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

  // Super Administrator only, same reasoning as role grants themselves — feeds
  // the admin UI's role-grant dropdown with the real seeded roles.
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Super Administrator')
  @Get('roles')
  findAllRoles() {
    return this.staffService.findAllRoles();
  }

  // Role grants are Super Administrator only. Every call is audit-logged
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
