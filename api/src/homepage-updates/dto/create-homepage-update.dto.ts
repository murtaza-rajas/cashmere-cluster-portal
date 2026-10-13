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

export class CreateHomepageUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  summary: string;

  @IsOptional()
  @IsDateString()
  displayDate?: string;

  // The article "Read the update" opens.
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers: MembershipTier[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
