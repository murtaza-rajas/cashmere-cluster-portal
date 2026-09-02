import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ShopifyWebhookGuard } from './shopify-webhook.guard';
import { ShopifyWebhooksService } from './shopify-webhooks.service';
import {
  ShopifyCustomersDataRequestPayload,
  ShopifyCustomersRedactPayload,
  ShopifyOrderPayload,
  ShopifyShopRedactPayload,
} from './types/shopify-webhook-payloads';

// Shopify's three mandatory GDPR compliance webhooks — every app processing
// Shopify customer data must implement these. HMAC-verified (ShopifyWebhookGuard)
// on every route: these must never be callable by anyone but Shopify, since they
// delete data by ID. Always respond 200 quickly (Shopify retries on non-2xx/timeout)
// — the actual work here is fast (a handful of DB writes), so no async queue needed
// at this scale.
@Controller('webhooks/shopify')
@UseGuards(ShopifyWebhookGuard)
export class ShopifyWebhooksController {
  constructor(private readonly webhooks: ShopifyWebhooksService) {}

  @Post('customers/data_request')
  @HttpCode(200)
  async customersDataRequest(@Req() req: Request) {
    await this.webhooks.handleCustomersDataRequest(
      req.body as ShopifyCustomersDataRequestPayload,
    );
  }

  @Post('customers/redact')
  @HttpCode(200)
  async customersRedact(@Req() req: Request) {
    await this.webhooks.handleCustomersRedact(
      req.body as ShopifyCustomersRedactPayload,
    );
  }

  @Post('shop/redact')
  @HttpCode(200)
  async shopRedact(@Req() req: Request) {
    await this.webhooks.handleShopRedact(req.body as ShopifyShopRedactPayload);
  }

  // Both fire the same upsert (see handleOrderSync) — orders/create for the
  // initial order, orders/updated for any later status change (e.g. paid, refunded).
  @Post('orders/create')
  @HttpCode(200)
  async ordersCreate(@Req() req: Request) {
    await this.webhooks.handleOrderSync(req.body as ShopifyOrderPayload);
  }

  @Post('orders/updated')
  @HttpCode(200)
  async ordersUpdated(@Req() req: Request) {
    await this.webhooks.handleOrderSync(req.body as ShopifyOrderPayload);
  }
}
