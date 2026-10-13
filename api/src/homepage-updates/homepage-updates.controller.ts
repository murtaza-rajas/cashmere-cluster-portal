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
import { HomepageUpdatesService } from './homepage-updates.service';
import { imageOnlyFileFilter } from '../common/image-upload.util';
import { CreateHomepageUpdateDto } from './dto/create-homepage-update.dto';
import { UpdateHomepageUpdateDto } from './dto/update-homepage-update.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Content Manager — the same role that writes the Stories the banner links
// to. Distinct path from any member page (see staff-directory, 2026-10-07).
@Controller('homepage-update-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Content Manager')
export class HomepageUpdatesController {
  constructor(private readonly updates: HomepageUpdatesService) {}

  @Get()
  findAll() {
    return this.updates.findAllForStaff();
  }

  @Post()
  create(@Body() dto: CreateHomepageUpdateDto, @Req() req: Request) {
    return this.updates.create(dto, req.staffUser!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHomepageUpdateDto,
    @Req() req: Request,
  ) {
    return this.updates.update(id, dto, req.staffUser!.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.updates.remove(id, req.staffUser!.id);
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
    return this.updates.uploadImage(id, file, req.staffUser!.id);
  }

  @Delete(':id/image')
  removeImage(@Param('id') id: string, @Req() req: Request) {
    return this.updates.removeImage(id, req.staffUser!.id);
  }
}
