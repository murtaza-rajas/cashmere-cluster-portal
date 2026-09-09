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
import { DesignsService, DesignImageSlot } from './designs.service';
import { imageOnlyFileFilter } from '../common/image-upload.util';
import { CreateDesignDto } from './dto/create-design.dto';
import { UpdateDesignDto } from './dto/update-design.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const VALID_SLOTS: DesignImageSlot[] = ['hero', 'swatch', 'sketch'];

// Staff CRUD for the Founders' Design Lab — no seeded role names "designs"
// explicitly, so Content Manager (its own description: "Editorial content:
// stories, news, videos, Care & Repair guides") is the closest fit among
// the 10 existing roles, same "pick the closest match, don't invent a role"
// approach as Club Manager for Site Images. Worth revisiting once the
// client's own upcoming "define what staff should access" conversation
// (PROJECT_TRACKER.md Section 3d) happens. Deliberately not /designs — no
// frontend page claims that path today, but the -catalog suffix keeps this
// safe if one ever does (same reasoning as every other *-catalog route).
@Controller('design-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Content Manager')
export class DesignsController {
  constructor(private readonly designs: DesignsService) {}

  @Get()
  findAll() {
    return this.designs.findAllForStaff();
  }

  @Post()
  create(@Body() dto: CreateDesignDto, @Req() req: Request) {
    return this.designs.create(dto, req.staffUser!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDesignDto,
    @Req() req: Request,
  ) {
    return this.designs.update(id, dto, req.staffUser!.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.designs.remove(id, req.staffUser!.id);
  }

  @Post(':id/image/:slot')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: imageOnlyFileFilter,
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @Param('slot') slot: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const validSlot = this.parseSlot(slot);
    return this.designs.uploadImage(id, validSlot, file, req.staffUser!.id);
  }

  @Delete(':id/image/:slot')
  removeImage(
    @Param('id') id: string,
    @Param('slot') slot: string,
    @Req() req: Request,
  ) {
    const validSlot = this.parseSlot(slot);
    return this.designs.removeImage(id, validSlot, req.staffUser!.id);
  }

  private parseSlot(value: string): DesignImageSlot {
    if (!VALID_SLOTS.includes(value as DesignImageSlot)) {
      throw new BadRequestException(`Unknown image slot: ${value}`);
    }
    return value as DesignImageSlot;
  }
}
