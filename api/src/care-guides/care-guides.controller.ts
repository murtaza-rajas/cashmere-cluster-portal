import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { CareGuidesService } from './care-guides.service';
import { UpdateCareGuideDto } from './dto/update-care-guide.dto';
import { CareGuideTopic } from '@prisma/client';

// Staff-facing Care & Repair guide content — Content Manager, per its seeded
// description naming "Care & Repair guides" explicitly, an exact match (no
// role-fit ambiguity, unlike Offers & Benefits/Site Images). No create/delete
// here — see care-guides.service.ts, topics are fixed and pre-seeded.
// Deliberately /care-guide-catalog, not /care-repair — matching the
// established -catalog naming precedent, even though there's no actual
// frontend page collision risk here (the member page is /care-repair).
@Controller('care-guide-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Content Manager')
export class CareGuidesController {
  constructor(private readonly careGuides: CareGuidesService) {}

  @Get()
  findAll() {
    return this.careGuides.findAllForStaff();
  }

  @Patch(':topic')
  update(
    @Param('topic') topic: string,
    @Body() dto: UpdateCareGuideDto,
    @Req() req: Request,
  ) {
    return this.careGuides.update(parseTopic(topic), dto, req.staffUser!.id);
  }
}

function parseTopic(value: string): CareGuideTopic {
  if (!Object.values(CareGuideTopic).includes(value as CareGuideTopic)) {
    throw new BadRequestException(`Unknown topic: ${value}`);
  }
  return value as CareGuideTopic;
}
