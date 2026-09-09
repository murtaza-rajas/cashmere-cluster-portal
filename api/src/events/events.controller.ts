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
import { EventsService } from './events.service';
import { imageOnlyFileFilter } from '../common/image-upload.util';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Staff CRUD for Events & Invitations — Event Manager, per its seeded
// description ("Events and invitations: creation, audience, registration and
// attendance"), an exact match. Deliberately not /events — that path is
// free right now, but naming it distinctly (matching /benefit-catalog and
// /site-image-catalog's precedent) keeps this safe if a member-facing
// frontend route ever claims it.
@Controller('event-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Event Manager')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  findAll() {
    return this.events.findAllForStaff();
  }

  @Post()
  create(@Body() dto: CreateEventDto, @Req() req: Request) {
    return this.events.create(dto, req.staffUser!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: Request,
  ) {
    return this.events.update(id, dto, req.staffUser!.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.events.remove(id, req.staffUser!.id);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      // Same reasoning as SiteImagesController — buffer in memory, the
      // service owns writing/replacing the file.
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
    return this.events.uploadImage(id, file, req.staffUser!.id);
  }

  @Delete(':id/image')
  removeImage(@Param('id') id: string, @Req() req: Request) {
    return this.events.removeImage(id, req.staffUser!.id);
  }
}
