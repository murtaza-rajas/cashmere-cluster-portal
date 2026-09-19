import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { NewsletterCampaignsService } from './newsletter-campaigns.service';
import { CreateNewsletterCampaignDto } from './dto/create-newsletter-campaign.dto';
import { UpdateNewsletterCampaignDto } from './dto/update-newsletter-campaign.dto';

// Newsletter Manager only — matches its seeded description exactly
// ("Newsletter operation: audiences, campaigns, schedules, statistics").
// No regional scoping: unlike Mongolia Editor, there's no client
// instruction to confine this role to one region, and a Mongolia-only
// campaign is just a row whose audienceRegions is [MONGOLIA] rather than a
// separate scoped-write concern.
@Controller('newsletter-campaigns')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Newsletter Manager')
export class NewsletterCampaignsController {
  constructor(private readonly campaigns: NewsletterCampaignsService) {}

  @Get()
  findAll() {
    return this.campaigns.findAll();
  }

  @Post()
  create(@Body() dto: CreateNewsletterCampaignDto, @Req() req: Request) {
    return this.campaigns.create(dto, req.staffUser!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsletterCampaignDto,
    @Req() req: Request,
  ) {
    return this.campaigns.update(id, dto, req.staffUser!.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.campaigns.remove(id, req.staffUser!.id);
  }
}
