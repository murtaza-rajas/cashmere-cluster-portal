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

export class CreateStoryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsString()
  designerName?: string;

  // Allowed to be empty on create (not targeted at any tier yet) — see
  // schema.prisma's comment on Story.tiers.
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers: MembershipTier[];

  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  // The whole section list, in the order they should render — not every
  // article needs every type, and a short Story might have just one or two.
  // Empty is valid (a title-only draft is a real intermediate state).
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorySectionDto)
  sections: StorySectionDto[];
}
