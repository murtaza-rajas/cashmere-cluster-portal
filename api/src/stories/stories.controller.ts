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
import { StoriesService } from './stories.service';
import { imageOnlyFileFilter } from '../common/image-upload.util';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Content Manager, per its seeded description ("Editorial content: stories,
// news, videos, Care & Repair guides.") — an exact match, same role already
// gating Care Guides and Design Lab. Deliberately not /stories — leaves
// that path free for a future member-facing route, matching /event-catalog
// and /benefit-catalog's precedent.
@Controller('story-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Content Manager')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  findAll() {
    return this.stories.findAllForStaff();
  }

  @Post()
  create(@Body() dto: CreateStoryDto, @Req() req: Request) {
    return this.stories.create(dto, req.staffUser!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStoryDto,
    @Req() req: Request,
  ) {
    return this.stories.update(id, dto, req.staffUser!.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.stories.remove(id, req.staffUser!.id);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: imageOnlyFileFilter,
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.stories.uploadImage(id, file, req.staffUser!.id);
  }

  @Delete(':id/image')
  removeImage(@Param('id') id: string, @Req() req: Request) {
    return this.stories.removeImage(id, req.staffUser!.id);
  }
}
