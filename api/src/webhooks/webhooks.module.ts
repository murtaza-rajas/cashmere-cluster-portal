import { Module } from '@nestjs/common';
import { ShopifyWebhooksController } from './shopify-webhooks.controller';
import { ShopifyWebhooksService } from './shopify-webhooks.service';
import { ShopifyWebhookGuard } from './shopify-webhook.guard';

@Module({
  controllers: [ShopifyWebhooksController],
  providers: [ShopifyWebhooksService, ShopifyWebhookGuard],
})
export class WebhooksModule {}
