import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

// No `tier` field here — a level's tier is fixed at creation (one row per
// MembershipTier, seeded once, never created/deleted by staff — see
// schema.prisma's comment on MembershipLevel). Every field optional, same
// reasoning as UpdateStoryDto: editing just the price shouldn't require
// resubmitting the whole level.
export class UpdateMembershipLevelDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceEur?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @IsOptional()
  @IsString()
  periodLabel?: string;

  @IsOptional()
  @IsString()
  benefits?: string;
}
