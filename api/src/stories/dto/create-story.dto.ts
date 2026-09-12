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

export class CreateStoryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  quote?: string;

  @IsOptional()
  @IsString()
  category?: string;

  // Allowed to be empty on create (a draft story visible to nobody yet) —
  // see schema.prisma's comment on Story.tiers.
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers: MembershipTier[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
