import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { MongoliaPhotoStatus } from '@prisma/client';

// Staff review action — approve/reject a pending submission. Deliberately
// not a general PATCH (unlike Story/Producer) since a photo's only
// meaningful edits are the review decision itself; the member's own
// caption stays untouched by staff.
export class ReviewMongoliaPhotoDto {
  @IsEnum(MongoliaPhotoStatus)
  status: MongoliaPhotoStatus;

  // Only meaningful when approving — ignored otherwise.
  @IsOptional()
  @IsBoolean()
  foundingOnly?: boolean;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
