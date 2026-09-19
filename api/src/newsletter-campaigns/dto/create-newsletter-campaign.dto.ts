import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  MembershipTier,
  NewsletterCampaignStatus,
  Region,
} from '@prisma/client';

export class CreateNewsletterCampaignDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsOptional()
  @IsString()
  body?: string;

  // Allowed to be empty on create (a draft not targeted at anyone yet) —
  // same convention as Benefit.tiers/Story.tiers.
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  audienceTiers: MembershipTier[];

  @IsOptional()
  @IsArray()
  @IsEnum(Region, { each: true })
  audienceRegions?: Region[];

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsEnum(NewsletterCampaignStatus)
  status?: NewsletterCampaignStatus;
}
