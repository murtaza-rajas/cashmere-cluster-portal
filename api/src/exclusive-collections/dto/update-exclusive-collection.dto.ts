import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MembershipTier } from '@prisma/client';

// Every field optional — same reasoning as UpdateEventDto/UpdateBenefitDto:
// editing one field shouldn't require resubmitting the whole row.
export class UpdateExclusiveCollectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

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
