import { Module } from '@nestjs/common';
import { ShopifyAdminController } from './shopify-admin.controller';
import { ShopifyAdminAuthService } from './shopify-admin-auth.service';
import { ShopifyAdminApiService } from './shopify-admin-api.service';

// Both exported so future commerce work (product/Selling Plan creation) can
// inject them without re-registering — same pattern as StaffModule exporting
// StaffAuthService. ShopifyAdminApiService (2026-10-08, first real caller:
// MailchimpService) is the generic GraphQL client; ShopifyAdminAuthService
// stays exported too since it's still the thing that manages the token
// ShopifyAdminApiService uses under the hood.
@Module({
  controllers: [ShopifyAdminController],
  providers: [ShopifyAdminAuthService, ShopifyAdminApiService],
  exports: [ShopifyAdminAuthService, ShopifyAdminApiService],
})
export class ShopifyAdminModule {}
