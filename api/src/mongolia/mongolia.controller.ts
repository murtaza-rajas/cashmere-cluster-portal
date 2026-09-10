import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { MongoliaService } from './mongolia.service';
import { imageOnlyFileFilter } from '../common/image-upload.util';
import { CreateMongoliaStoryDto } from './dto/create-mongolia-story.dto';
import { UpdateMongoliaStoryDto } from './dto/update-mongolia-story.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Staff CRUD for Cashmere Lovers Club Mongolia content — Content Manager,
// same role as Care & Repair/Design Lab ("Editorial content: stories, news,
// videos, Care & Repair guides"). Deliberately /mongolia-catalog, not
// /mongolia — the member-facing Mongolia section lives at that exact bare
// path (see app/(mongolia)/page.tsx), same collision-avoidance reasoning as
// every other *-catalog route in this app.
@Controller('mongolia-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Content Manager')
export class MongoliaController {
  constructor(private readonly mongolia: MongoliaService) {}

  @Get('stories')
  findAllStories() {
    return this.mongolia.findAllStoriesForStaff();
  }

  @Post('stories')
  createStory(@Body() dto: CreateMongoliaStoryDto, @Req() req: Request) {
    return this.mongolia.createStory(dto, req.staffUser!.id);
  }

  @Patch('stories/:id')
  updateStory(
    @Param('id') id: string,
    @Body() dto: UpdateMongoliaStoryDto,
    @Req() req: Request,
  ) {
    return this.mongolia.updateStory(id, dto, req.staffUser!.id);
  }

  @Delete('stories/:id')
  removeStory(@Param('id') id: string, @Req() req: Request) {
    return this.mongolia.removeStory(id, req.staffUser!.id);
  }

  @Post('stories/:id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: imageOnlyFileFilter,
    }),
  )
  async uploadStoryImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.mongolia.uploadStoryImage(id, file, req.staffUser!.id);
  }

  @Delete('stories/:id/image')
  removeStoryImage(@Param('id') id: string, @Req() req: Request) {
    return this.mongolia.removeStoryImage(id, req.staffUser!.id);
  }
}
