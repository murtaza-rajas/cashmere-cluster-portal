import { IsOptional, IsString } from 'class-validator';

export class CompleteRequestDto {
  // Not required by Shopify's ACCESS/EXPORT flow, but lets staff record how/where
  // the export was actually delivered (e.g. "emailed export to member") for the
  // compliance trail — see AuditLogEntry.reason.
  @IsOptional()
  @IsString()
  reason?: string;
}
