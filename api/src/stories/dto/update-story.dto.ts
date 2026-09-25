import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MembershipTier, StoryStatus } from '@prisma/client';
import { StorySectionDto } from './story-section.dto';

// Every field optional, same partial-update pattern as UpdateEventDto —
// except `sections`, which when present always replaces the whole list
// (see StoriesService.update's comment for why: staff manage the section
// order/composition as one unit in the admin builder, not field-by-field).
export class UpdateStoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  designerName?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers?: MembershipTier[];

  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorySectionDto)
  sections?: StorySectionDto[];
}
