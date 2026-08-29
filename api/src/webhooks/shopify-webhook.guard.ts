import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Without this, anyone could POST to the redact endpoints and delete arbitrary
// members by guessing a shopifyCustomerId — these routes MUST verify the request
// actually came from Shopify. Shopify signs each webhook with HMAC-SHA256 over the
// raw request body, using the app's webhook secret; the result is base64-encoded
// and sent in the X-Shopify-Hmac-Sha256 header. Rejects (401) on any mismatch or
// missing signature, and if req.rawBody isn't populated (misconfigured — see
// main.ts's rawBody: true) rather than silently treating it as valid.
@Injectable()
export class ShopifyWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-shopify-hmac-sha256'];

    if (!req.rawBody || typeof signature !== 'string') {
      throw new UnauthorizedException('Missing webhook signature or raw body');
    }

    const secret = this.config.getOrThrow<string>('SHOPIFY_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('base64');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');

    // timingSafeEqual throws if lengths differ, rather than returning false —
    // guard that explicitly instead of leaking timing information via a crash.
    const valid =
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer);

    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
