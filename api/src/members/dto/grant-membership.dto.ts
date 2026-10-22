import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MembershipTier } from '@prisma/client';

export const GRANTABLE_TIERS = [
  MembershipTier.SIX_MONTH,
  MembershipTier.ANNUAL,
  MembershipTier.FOUNDING,
  // Cashmere Lovers Club Mongolia — also moves the member to the Mongolia
  // site (region MONGOLIA); the other levels are the international site.
  MembershipTier.MONGOLIA,
] as const;

// Staff adding a member by hand (pilot customers, client request 2026-10-17).
export class GrantMembershipDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsIn(GRANTABLE_TIERS)
  tier!: (typeof GRANTABLE_TIERS)[number];

  @IsInt()
  @Min(1)
  @Max(60)
  months!: number;
}
