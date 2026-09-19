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

// Every field optional — a staff member editing one row shouldn't have to
// resubmit the whole thing, same partial-update pattern as UpdateBenefitDto.
export class UpdateNewsletterCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(MembershipTier, { each: true })
  audienceTiers?: MembershipTier[];

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
