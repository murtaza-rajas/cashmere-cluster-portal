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
import { ExclusiveCollectionsService } from './exclusive-collections.service';
import { imageOnlyFileFilter } from '../common/image-upload.util';
import { CreateExclusiveCollectionDto } from './dto/create-exclusive-collection.dto';
import { UpdateExclusiveCollectionDto } from './dto/update-exclusive-collection.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Club Manager — same role as Offers & Benefits (benefits.controller.ts),
// the closest existing precedent: member-facing perks/merchandising content,
// not a Mongolia-specific concept (no Mongolia Editor access here, unlike
// Events/Benefits — the member-facing page has no Mongolia equivalent).
// Deliberately not /exclusive-collections — that's the real member-facing
// page's own route; naming this distinctly (matching /event-catalog,
// /benefit-catalog) avoids the exact bare-path collision staff-directory
// hit in production 2026-10-07.
@Controller('exclusive-collection-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Club Manager')
export class ExclusiveCollectionsController {
  constructor(private readonly collections: ExclusiveCollectionsService) {}

  @Get()
  findAll() {
    return this.collections.findAllForStaff();
  }

  @Post()
  create(@Body() dto: CreateExclusiveCollectionDto, @Req() req: Request) {
    return this.collections.create(dto, req.staffUser!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExclusiveCollectionDto,
    @Req() req: Request,
  ) {
    return this.collections.update(id, dto, req.staffUser!.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.collections.remove(id, req.staffUser!.id);
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
    return this.collections.uploadImage(id, file, req.staffUser!.id);
  }

  @Delete(':id/image')
  removeImage(@Param('id') id: string, @Req() req: Request) {
    return this.collections.removeImage(id, req.staffUser!.id);
  }
}
