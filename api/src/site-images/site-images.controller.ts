import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
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
import { SiteImagesService } from './site-images.service';
import { MembershipTier, SiteImageSlot } from '@prisma/client';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Staff upload/replace/remove for the tier-specific hero photos — Club
// Manager (per its "benefits, offers" remit, the closest existing role to
// member-facing content) or Content Manager (editorial/visual content).
// Deliberately not /site-images — no frontend page currently claims that
// path, but naming it distinctly (matching /benefit-catalog's precedent)
// keeps this safe against ever colliding with one later.
@Controller('site-image-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Club Manager', 'Content Manager')
export class SiteImagesController {
  constructor(private readonly siteImages: SiteImagesService) {}

  @Get()
  findAll() {
    return this.siteImages.findAllForStaff();
  }

  @Post(':slot/:tier')
  @UseInterceptors(
    FileInterceptor('file', {
      // Buffer in memory, not multer's own disk storage — the service owns
      // writing the final file so it can also clean up the old one in the
      // same place, rather than splitting that logic across two layers.
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @Param('slot') slot: string,
    @Param('tier') tier: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const validSlot = parseSlot(slot);
    const validTier = parseTier(tier);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.siteImages.upsert({
      slot: validSlot,
      tier: validTier,
      file,
      staffUserId: req.staffUser!.id,
    });
  }

  @Delete(':slot/:tier')
  remove(
    @Param('slot') slot: string,
    @Param('tier') tier: string,
    @Req() req: Request,
  ) {
    return this.siteImages.remove(
      parseSlot(slot),
      parseTier(tier),
      req.staffUser!.id,
    );
  }
}

function parseSlot(value: string): SiteImageSlot {
  if (!Object.values(SiteImageSlot).includes(value as SiteImageSlot)) {
    throw new BadRequestException(`Unknown slot: ${value}`);
  }
  return value as SiteImageSlot;
}

function parseTier(value: string): MembershipTier {
  if (!Object.values(MembershipTier).includes(value as MembershipTier)) {
    throw new BadRequestException(`Unknown tier: ${value}`);
  }
  return value as MembershipTier;
}
