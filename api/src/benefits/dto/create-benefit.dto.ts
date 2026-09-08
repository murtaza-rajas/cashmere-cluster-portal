import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { BenefitType, MembershipTier } from '@prisma/client';

export class CreateBenefitDto {
  @IsEnum(BenefitType)
  type: BenefitType;

  // Allowed to be empty on create (a draft row visible to nobody yet) — see
  // schema.prisma's comment on Benefit.tiers for why that's the deliberate
  // meaning of an empty array, not "everyone".
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers: MembershipTier[];

  @IsOptional()
  @IsString()
  icon?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

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
