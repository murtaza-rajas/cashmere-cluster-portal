import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { StoryCategoriesService } from './story-categories.service';
import { CreateStoryCategoryDto } from './dto/create-story-category.dto';

// Read: Content Manager, same role that edits stories — needs the list to
// populate the category picker. Create: Super Administrator only, method-
// level override — the client's explicit instruction (2026-09-24 email):
// "Other staff/editors should be able to select from the existing
// categories, but not create new ones." No delete/update endpoint — the
// client only asked for adding categories over time, not renaming/removing
// them, and removing one out from under stories that reference it would
// need a real decision this session doesn't need to guess at.
@Controller('story-categories')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Content Manager')
export class StoryCategoriesController {
  constructor(private readonly categories: StoryCategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAll();
  }

  @Post()
  @Roles('Super Administrator')
  create(@Body() dto: CreateStoryCategoryDto, @Req() req: Request) {
    return this.categories.create(dto, req.staffUser!.id);
  }
}
