import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from './guards/staff-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { StaffService } from './staff.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

// Split out from StaffController 2026-10-07 — this used to be the bare
// GET/POST /staff endpoints, but production uses the same-origin rewrite
// proxy (NEXT_PUBLIC_API_URL === FRONTEND_URL), and Next.js resolves a
// non-dynamic page (app/staff/page.tsx, the staff home page) BEFORE it ever
// applies next.config.ts's afterFiles rewrites. A plain GET /staff from the
// browser was landing on the frontend page's HTML, not this JSON endpoint —
// `res.json()` on the client then failed with "unexpected character at line
// 1 column 1", since HTML isn't JSON. Exactly the collision next.config.ts's
// own long-standing comment on this predicted ("the one genuinely
// irreducible collision... will [reproduce] once this is tested through the
// single-tunnel/production-style setup") — caught live from a real client
// report, not in testing, since local dev's NEXT_PUBLIC_API_URL points
// straight at the API and bypasses the proxy entirely.
//
// Fixed by moving off the bare /staff path entirely, matching the existing
// -catalog/-directory naming convention used everywhere else in this app for
// the identical reason (see e.g. /benefit-catalog, /order-catalog,
// /staff-dashboard) — a distinct top-level path no frontend page will ever
// occupy, rather than anything nested under /staff/* (which has its own
// growing set of real frontend pages: /staff/directory, /staff/members,
// etc. — any of those would just recreate the same collision one level
// deeper).
@Controller('staff-directory')
export class StaffDirectoryController {
  constructor(private readonly staffService: StaffService) {}

  // "Super Administrators create staff accounts" (PDF page 3).
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
}
