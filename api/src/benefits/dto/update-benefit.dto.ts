import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { BenefitType, MembershipTier, Region } from '@prisma/client';

// Every field optional — a staff member editing one row shouldn't have to
// resubmit the whole thing, and partial updates are the normal shape here
// (e.g. just toggling `active`, or re-numbering `sortOrder`).
export class UpdateBenefitDto {
  @IsOptional()
  @IsEnum(BenefitType)
  type?: BenefitType;

  @IsOptional()
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers?: MembershipTier[];

  @IsOptional()
  @IsArray()
  @IsEnum(Region, { each: true })
  regions?: Region[];

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
