import { Controller, Get, Query, Req, Res, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ShopifyAdminAuthService } from './shopify-admin-auth.service';

const STATE_COOKIE = 'clc_shopify_admin_state';
// 10 minutes — this is an interactive, one-click merchant flow (not email-OTP
// like member login's PKCE cookie), so it doesn't need as long a window.
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

// Admin API install flow for the live store's commerce integration (products,
// Selling Plans, customer creation) — see ShopifyAdminAuthService's own
// comment for why this exists as a separate app/flow from member login.
// Deliberately public (no staff auth guard): Shopify itself redirects the
// merchant's browser here mid-flow, and the real protection is the hmac +
// state checks below, exactly like the existing member OAuth callback.
@Controller('auth/shopify')
export class ShopifyAdminController {
  constructor(
    private readonly shopifyAdminAuth: ShopifyAdminAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('admin-install')
  adminInstall(@Res() res: Response) {
    const state = this.shopifyAdminAuth.generateState();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE_MS,
      path: '/auth/shopify/admin-callback',
    });
    return res.redirect(this.shopifyAdminAuth.buildAuthorizeUrl(state));
  }

  @Get('admin-callback')
  async adminCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('shop') shop: string,
    @Query('hmac') hmac: string,
    @Query('timestamp') timestamp: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code || !state || !shop || !hmac) {
      throw new BadRequestException('Missing required parameters on Shopify OAuth callback');
    }

    this.shopifyAdminAuth.verifyCallbackHmac({ code, state, shop, hmac, timestamp });

    const cookies = req.cookies as Record<string, string> | undefined;
    const expectedState = cookies?.[STATE_COOKIE];
    if (!expectedState || expectedState !== state) {
      throw new BadRequestException(
        'State mismatch on Shopify OAuth callback — possible CSRF, or the install link expired (10 min window). Try /auth/shopify/admin-install again.',
      );
    }

    await this.shopifyAdminAuth.exchangeCodeForToken(code);

    res.clearCookie(STATE_COOKIE, { path: '/auth/shopify/admin-callback' });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/staff/integrations`);
  }
}
