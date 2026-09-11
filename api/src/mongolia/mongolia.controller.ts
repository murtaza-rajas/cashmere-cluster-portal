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
import { CreateMongoliaProducerDto } from './dto/create-mongolia-producer.dto';
import { UpdateMongoliaProducerDto } from './dto/update-mongolia-producer.dto';
import { ReviewMongoliaPhotoDto } from './dto/review-mongolia-photo.dto';

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

  @Get('producers')
  findAllProducers() {
    return this.mongolia.findAllProducersForStaff();
  }

  @Post('producers')
  createProducer(
    @Body() dto: CreateMongoliaProducerDto,
    @Req() req: Request,
  ) {
    return this.mongolia.createProducer(dto, req.staffUser!.id);
  }

  @Patch('producers/:id')
  updateProducer(
    @Param('id') id: string,
    @Body() dto: UpdateMongoliaProducerDto,
    @Req() req: Request,
  ) {
    return this.mongolia.updateProducer(id, dto, req.staffUser!.id);
  }

  @Delete('producers/:id')
  removeProducer(@Param('id') id: string, @Req() req: Request) {
    return this.mongolia.removeProducer(id, req.staffUser!.id);
  }

  @Post('producers/:id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: imageOnlyFileFilter,
    }),
  )
  async uploadProducerImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.mongolia.uploadProducerImage(id, file, req.staffUser!.id);
  }

  @Delete('producers/:id/image')
  removeProducerImage(@Param('id') id: string, @Req() req: Request) {
    return this.mongolia.removeProducerImage(id, req.staffUser!.id);
  }

  // Photo Archive moderation — approve/reject/delete member submissions.
  // No POST here: photos are only ever member-submitted (see
  // MembersController's mongoliaSubmitPhoto), not staff-created.
  @Get('photos')
  findAllPhotos() {
    return this.mongolia.findAllPhotosForStaff();
  }

  @Patch('photos/:id')
  reviewPhoto(
    @Param('id') id: string,
    @Body() dto: ReviewMongoliaPhotoDto,
    @Req() req: Request,
  ) {
    return this.mongolia.reviewPhoto(id, dto, req.staffUser!.id);
  }

  @Delete('photos/:id')
  removePhoto(@Param('id') id: string, @Req() req: Request) {
    return this.mongolia.removePhoto(id, req.staffUser!.id);
  }
}
