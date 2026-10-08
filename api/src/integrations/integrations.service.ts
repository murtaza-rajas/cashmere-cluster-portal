import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Real status only — presence of config, real timestamps from tables the
// webhooks actually write to. No fabricated "connected"/"synced" state for
// integrations that don't exist in code yet (Mailchimp, a CMS): those report
// `built: false` rather than a guessed-at status.
@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const [lastOrderWebhook, lastGdprWebhook, databaseHealthy] =
      await Promise.all([
        this.prisma.memberOrderCache.findFirst({
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
        this.prisma.dataSubjectRequest.findFirst({
          where: { sourceShopifyWebhookId: { not: null } },
          orderBy: { requestedAt: 'desc' },
          select: { requestedAt: true },
        }),
        this.checkDatabase(),
      ]);

    return {
      shopify: {
        // Presence only — never the values themselves, those are secrets.
        oauthConfigured: Boolean(
          process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_SHOP_DOMAIN,
        ),
        webhookSecretConfigured: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET),
        // The store domain itself isn't sensitive (it's the public storefront
        // URL) — safe and useful to show, unlike the client ID/secret.
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN ?? null,
        webhookEndpoints: [
          '/webhooks/shopify/orders/create',
          '/webhooks/shopify/orders/updated',
          '/webhooks/shopify/customers/data_request',
          '/webhooks/shopify/customers/redact',
          '/webhooks/shopify/shop/redact',
        ],
        lastOrderWebhookAt: lastOrderWebhook?.updatedAt ?? null,
        lastGdprWebhookAt: lastGdprWebhook?.requestedAt ?? null,
      },
      database: { healthy: databaseHealthy },
      // Built 2026-10-08 (the Mailchimp-only-subscriber login piece,
      // PROJECT_TRACKER.md Section 3b) — presence only, never the key/
      // audience id themselves. audienceIdConfigured is called out
      // separately from apiKeyConfigured since the API key alone was
      // present for weeks before the real audience id was ever supplied —
      // same "don't claim more than what's actually configured" discipline
      // as the Shopify block above.
      mailchimp: {
        built: true,
        apiKeyConfigured: Boolean(process.env.MAILCHIMP_API_KEY),
        audienceIdConfigured: Boolean(process.env.MAILCHIMP_AUDIENCE_ID),
      },
      // Decided (CLAUDE.md/PROJECT_TRACKER.md Section 4) but not yet built —
      // no env var or code path exists, so there's nothing real to report
      // beyond that.
      cms: { built: false },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
