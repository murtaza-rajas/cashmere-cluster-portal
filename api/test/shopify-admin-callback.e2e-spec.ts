import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHmac } from 'crypto';
import { createTestApp } from './test-app.util';

// Real bug, found live 2026-10-06: Shopify's actual OAuth callback carries more
// query params than the five the controller used to hand-pick (code/state/shop/
// hmac/timestamp) — a `host` param was present on the first real attempt against
// the live store. Shopify signs its hmac over every param it actually sends, so
// verifying against a hand-picked subset silently drops any extra param from the
// signed message, producing a deterministic "Invalid hmac" on every real request
// regardless of how correct the secret/algorithm otherwise are. These tests
// exercise the real HTTP layer (not the service method directly) since the bug
// was specifically in what the controller passed to the verifier, not the
// verifier's own hashing logic.
describe('Shopify Admin API OAuth callback (e2e)', () => {
  let app: INestApplication<App>;
  let secret: string;

  beforeAll(async () => {
    app = await createTestApp();
    secret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET!;
  });

  afterAll(async () => {
    await app.close();
  });

  function sign(query: Record<string, string>): string {
    const message = Object.keys(query)
      .sort()
      .map((key) => `${key}=${query[key]}`)
      .join('&');
    return createHmac('sha256', secret).update(message).digest('hex');
  }

  const baseParams = {
    code: 'test-code',
    shop: 'cashmerehouse-no.myshopify.com',
    state: 'test-state',
    timestamp: '1759999999',
  };

  it('verifies correctly when the real callback includes an extra param (host) signed into the hmac', async () => {
    const withHost = { ...baseParams, host: 'ZmFrZS1ob3N0' };
    const hmac = sign(withHost);

    const res = await request(app.getHttpServer())
      .get('/auth/shopify/admin-callback')
      .query({ ...withHost, hmac });

    // No state cookie was set in this test, so the hmac check passing is proven
    // by reaching the *next* check (state mismatch) rather than failing hmac
    // itself — the old, buggy code returned "Invalid hmac" for this exact request.
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('State mismatch');
  });

  it('rejects a request where an extra param (host) is present but was left out of the signed message', async () => {
    // Reproduces the real bug exactly: hmac computed over only the 5 original
    // hand-picked fields, even though `host` is present in the actual request.
    const hmac = sign(baseParams);
    const withHost = { ...baseParams, host: 'ZmFrZS1ob3N0' };

    const res = await request(app.getHttpServer())
      .get('/auth/shopify/admin-callback')
      .query({ ...withHost, hmac });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid hmac on Shopify OAuth callback');
  });

  it('still verifies correctly with no extra params at all (plain 4-field callback)', async () => {
    const hmac = sign(baseParams);

    const res = await request(app.getHttpServer())
      .get('/auth/shopify/admin-callback')
      .query({ ...baseParams, hmac });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('State mismatch');
  });

  it('rejects a tampered hmac outright', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/shopify/admin-callback')
      .query({ ...baseParams, hmac: 'not-the-real-hmac' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid hmac on Shopify OAuth callback');
  });
});
