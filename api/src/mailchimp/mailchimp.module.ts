import { Module } from '@nestjs/common';
import { MailchimpService } from './mailchimp.service';
import { ShopifyAdminModule } from '../shopify-admin/shopify-admin.module';

@Module({
  imports: [ShopifyAdminModule],
  providers: [MailchimpService],
  exports: [MailchimpService],
})
export class MailchimpModule {}
