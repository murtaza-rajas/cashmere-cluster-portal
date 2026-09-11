import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { getScopedRegion } from '../staff/region-scope.util';
import { BenefitsService } from './benefits.service';
import { CreateBenefitDto } from './dto/create-benefit.dto';
import { UpdateBenefitDto } from './dto/update-benefit.dto';
import { BenefitType } from '@prisma/client';

// Full access is Club Manager per the seeded role description ("members,
// status, benefits, offers, reporting"). Mongolia Editor (2026-09-11) also
// reaches this controller, confined to Mongolia-only rows (see
// region-scope.util.ts) — same backend, same admin logic, just narrower,
// per the client's own "reuse the existing CLC admin components"
// instruction. Deliberately NOT named /benefits — the member-facing
// "My Benefits" page already owns that exact frontend route
// (app/(member)/benefits/page.tsx), and next.config.ts's rewrite-proxy
// notes the same class of bug already hit once with /staff: a bare path
// shared between a frontend page and a backend route means the page
// always wins for a plain GET once traffic goes through the
// single-tunnel/production proxy. This path has no frontend page at all,
// so a blanket rewrite for it is safe.
@Controller('benefit-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Club Manager', 'Mongolia Editor')
export class BenefitsController {
  constructor(private readonly benefits: BenefitsService) {}

  @Get()
  findAll(@Query('type') type: BenefitType | undefined, @Req() req: Request) {
    return this.benefits.findAllForStaff(
      type,
      getScopedRegion(req.staffUser!.roles, ['Club Manager']),
    );
  }

  @Post()
  create(@Body() dto: CreateBenefitDto, @Req() req: Request) {
    return this.benefits.create(
      dto,
      req.staffUser!.id,
      getScopedRegion(req.staffUser!.roles, ['Club Manager']),
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBenefitDto,
    @Req() req: Request,
  ) {
    return this.benefits.update(
      id,
      dto,
      req.staffUser!.id,
      getScopedRegion(req.staffUser!.roles, ['Club Manager']),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.benefits.remove(
      id,
      req.staffUser!.id,
      getScopedRegion(req.staffUser!.roles, ['Club Manager']),
    );
  }
}
