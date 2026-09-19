import { Module } from '@nestjs/common';
import { NewsletterCampaignsController } from './newsletter-campaigns.controller';
import { NewsletterCampaignsService } from './newsletter-campaigns.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [NewsletterCampaignsController],
  providers: [NewsletterCampaignsService],
})
export class NewsletterCampaignsModule {}
