import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { EventLocationType, MembershipTier, Region } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventLocationType)
  locationType: EventLocationType;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsUrl()
  registrationUrl?: string;

  // Allowed to be empty on create (a draft event visible to nobody yet) —
  // see schema.prisma's comment on Event.tiers.
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  tiers: MembershipTier[];

  // Optional — undefined means "both regions" server-side, same reasoning
  // as CreateBenefitDto.regions.
  @IsOptional()
  @IsArray()
  @IsEnum(Region, { each: true })
  regions?: Region[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
