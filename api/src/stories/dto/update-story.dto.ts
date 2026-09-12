import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MembershipTier } from '@prisma/client';

// Every field optional — same reasoning as UpdateEventDto: a staff member
// editing one field shouldn't have to resubmit the whole story.
export class UpdateStoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  quote?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers?: MembershipTier[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
