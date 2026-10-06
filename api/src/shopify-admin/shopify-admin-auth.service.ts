import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

// Refresh this far ahead of actual expiry — the access token only lives 1 hour
// (see the class comment below), so a request arriving seconds before expiry
// must not be handed a token that dies mid-flight.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

interface ShopifyTokenResponse {
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number; // seconds, 3600 for an expiring offline token
  refresh_token_expires_in: number; // seconds, 7776000 (90 days) when issued
}

// Admin API access (products, Selling Plans, customers) for the live store —
// NOT the same app/credentials as ShopifyIdentityProvider (that's the Customer
// Account API, member login, PKCE, no client secret). This one is a confidential
// client (SHOPIFY_ADMIN_CLIENT_ID/SECRET) using the classic Authorization Code
// Grant, created via the Dev Dashboard (legacy custom app creation closed
// 2026-01-01, see PROJECT_TRACKER.md). On a real paid store (not a dev store),
// this does NOT get Shopify's old-style non-expiring token — Shopify issues a
// 1-hour access token plus a 90-day refresh token, and expects the app to keep
// silently refreshing it server-side. ShopifyAdminToken (schema.prisma) is
// where that lives; getValidAccessToken() below is the one method every other
// piece of Admin API code should call — nothing else should read the token
// columns directly or assume a token lives forever once obtained.
@Injectable()
export class ShopifyAdminAuthService {
  private readonly logger = new Logger(ShopifyAdminAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get shopDomain(): string {
    return this.config.getOrThrow<string>('SHOPIFY_SHOP_DOMAIN');
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>('SHOPIFY_ADMIN_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('SHOPIFY_ADMIN_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return this.config.getOrThrow<string>('SHOPIFY_ADMIN_REDIRECT_URI');
  }

  private get scopes(): string {
    return 'read_products,write_products,read_inventory,write_inventory,read_purchase_options,write_purchase_options,read_customers,write_customers,read_orders';
  }

  generateState(): string {
    return randomBytes(16).toString('hex');
  }

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state,
    });
    return `https://${this.shopDomain}/admin/oauth/authorize?${params.toString()}`;
  }

  // Shopify signs the callback query string (minus `hmac` itself) with the
  // app's client secret — hex-encoded, deliberately different from the base64
  // encoding webhook signatures use (see ShopifyWebhookGuard). This is what
  // actually proves the request came from Shopify, not just a guessed URL —
  // the `state` cookie check in the controller proves it's the same browser
  // session that started this specific install, a different and equally
  // necessary check.
  verifyCallbackHmac(query: Record<string, string>): void {
    const { hmac, ...rest } = query;
    if (!hmac) {
      throw new UnauthorizedException('Missing hmac on Shopify OAuth callback');
    }

    const message = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join('&');

    const expected = createHmac('sha256', this.clientSecret)
      .update(message)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(hmac, 'utf8');

    const valid =
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer);

    if (!valid) {
      throw new UnauthorizedException('Invalid hmac on Shopify OAuth callback');
    }
  }

  async exchangeCodeForToken(code: string): Promise<void> {
    const { data } = await axios.post<ShopifyTokenResponse>(
      `https://${this.shopDomain}/admin/oauth/access_token`,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } },
    );
    await this.persist(data);
    this.logger.log(`Shopify Admin API token obtained, scope: ${data.scope}`);
  }

  private async refresh(refreshToken: string): Promise<void> {
    const { data } = await axios.post<ShopifyTokenResponse>(
      `https://${this.shopDomain}/admin/oauth/access_token`,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } },
    );
    await this.persist(data);
    this.logger.log('Shopify Admin API token refreshed');
  }

  private async persist(data: ShopifyTokenResponse): Promise<void> {
    const now = Date.now();
    await this.prisma.shopifyAdminToken.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope,
        accessTokenExpiresAt: new Date(now + data.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + data.refresh_token_expires_in * 1000),
      },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope,
        accessTokenExpiresAt: new Date(now + data.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + data.refresh_token_expires_in * 1000),
      },
    });
  }

  // The one method everything else should call. Returns a token guaranteed
  // valid for at least REFRESH_SKEW_MS, refreshing first if needed. Throws if
  // the app was never installed, or if the refresh token itself has expired
  // (90 days unused) — in either case the only fix is re-running the install
  // flow (GET /auth/shopify/admin-install), there's no silent recovery from
  // a dead refresh token.
  async getValidAccessToken(): Promise<string> {
    const row = await this.prisma.shopifyAdminToken.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!row) {
      throw new UnauthorizedException(
        'Shopify Admin API not connected yet — visit /auth/shopify/admin-install to connect it',
      );
    }

    if (row.accessTokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
      return row.accessToken;
    }

    if (row.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(
        'Shopify Admin API connection expired (refresh token lapsed after 90 days unused) — reconnect via /auth/shopify/admin-install',
      );
    }

    await this.refresh(row.refreshToken);
    const refreshed = await this.prisma.shopifyAdminToken.findUniqueOrThrow({
      where: { id: SINGLETON_ID },
    });
    return refreshed.accessToken;
  }
}
