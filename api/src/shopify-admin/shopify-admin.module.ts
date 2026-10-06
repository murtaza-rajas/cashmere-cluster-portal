import { Module } from '@nestjs/common';
import { ShopifyAdminController } from './shopify-admin.controller';
import { ShopifyAdminAuthService } from './shopify-admin-auth.service';

// Exported so future commerce work (product/Selling Plan creation, the
// Mailchimp-only-subscriber customerCreate work) can inject
// ShopifyAdminAuthService without re-registering it — same pattern as
// StaffModule exporting StaffAuthService.
@Module({
  controllers: [ShopifyAdminController],
  providers: [ShopifyAdminAuthService],
  exports: [ShopifyAdminAuthService],
})
export class ShopifyAdminModule {}
