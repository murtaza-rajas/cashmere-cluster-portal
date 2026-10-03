import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Gender } from '@prisma/client';

// Self-service profile fields only — never email/firstName/lastName, which stay
// Shopify-synced (see MembersService.findOrCreateFromIdentity). All optional: a
// member can leave any of these blank or clear them later (client requirement,
// 2026-10-03).
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryOfResidence?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
