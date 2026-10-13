import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MembershipTier } from '@prisma/client';

// Every field optional; storyId/displayDate accept null to clear them.
export class UpdateHomepageUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  summary?: string;

  @IsOptional()
  @IsDateString()
  displayDate?: string | null;

  @IsOptional()
  @IsUUID()
  storyId?: string | null;

  @IsOptional()
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers?: MembershipTier[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
