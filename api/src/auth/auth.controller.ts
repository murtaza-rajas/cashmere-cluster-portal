import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ShopifyIdentityProvider } from './providers/shopify-identity.provider';
import { AuthService } from './auth.service';
import { PkceState } from './interfaces/identity-provider.interface';

const PKCE_COOKIE = 'clc_pkce';
const SESSION_COOKIE = 'clc_session';
const PKCE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes — just long enough for the redirect round-trip
const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Cookie-based session, deliberately not a token-in-URL handoff: the backend sets an
// httpOnly, Secure cookie scoped to the shared parent domain (e.g. .cashmerehouse.com),
// so the Next.js frontend never needs to touch the raw JWT (no XSS-accessible storage,
// nothing to leak via URL/fragment/logs). The frontend calls the API with
// `credentials: "include"`; CORS is configured in main.ts to allow that from the
// frontend origin specifically.
@Controller('auth/shopify')
export class AuthController {
  constructor(
    private readonly shopify: ShopifyIdentityProvider,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('login')
  async login(@Res() res: Response) {
    const { redirectUrl, pkce } =
      await this.shopify.buildAuthorizationRequest();

    res.cookie(PKCE_COOKIE, JSON.stringify(pkce satisfies PkceState), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: PKCE_COOKIE_MAX_AGE_MS,
      path: '/auth/shopify/callback',
    });

    return res.redirect(redirectUrl);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException(
        'Missing code or state from Shopify callback',
      );
    }

    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[PKCE_COOKIE];
    if (!raw) {
      throw new BadRequestException(
        'Missing or expired PKCE cookie — please try logging in again',
      );
    }
    const pkce = JSON.parse(raw) as PkceState;

    if (pkce.state !== state) {
      throw new BadRequestException(
        'State mismatch — possible CSRF, aborting login',
      );
    }

    const identity = await this.shopify.handleCallback(code, pkce);
    const { accessToken } =
      await this.authService.issueSessionForIdentity(identity);

    res.clearCookie(PKCE_COOKIE, { path: '/auth/shopify/callback' });

    res.cookie(SESSION_COOKIE, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      domain: this.config.get<string>('COOKIE_DOMAIN'), // e.g. ".cashmerehouse.com" in production
      path: '/',
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    return res.redirect(frontendUrl);
  }
}
