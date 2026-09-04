import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHmac } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

// Exercises the real HTTP layer (not just the service methods) specifically
// because the thing most likely to be broken here is the raw-body/HMAC wiring
// itself, which only exists at the HTTP boundary (main.ts's rawBody: true,
// ShopifyWebhookGuard reading req.rawBody) — calling the service directly would
// never catch a misconfigured guard.
describe('Shopify GDPR webhooks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;
  let secret: string;

  beforeAll(async () => {
    app = await createTestApp({ rawBody: true });
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
    secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
  });

  afterAll(async () => {
    await app.close();
  });

  function sign(rawBody: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('base64');
  }

  function post(path: string, payload: object, { validSignature = true } = {}) {
    const rawBody = JSON.stringify(payload);
    const req = request(app.getHttpServer())
      .post(path)
      .set('Content-Type', 'application/json');
    if (validSignature) {
      req.set('X-Shopify-Hmac-Sha256', sign(rawBody));
    } else {
      req.set('X-Shopify-Hmac-Sha256', 'not-a-real-signature');
    }
    return req.send(rawBody);
  }

  it('rejects an invalid signature with 401, for all three routes', async () => {
    const payload = { shop_id: 1, shop_domain: 'test.myshopify.com' };
    await post('/webhooks/shopify/customers/data_request', payload, {
      validSignature: false,
    }).expect(401);
    await post('/webhooks/shopify/customers/redact', payload, {
      validSignature: false,
    }).expect(401);
    await post('/webhooks/shopify/shop/redact', payload, {
      validSignature: false,
    }).expect(401);
  });

  it('customers/data_request creates a DataSubjectRequest and logs it, for a known member', async () => {
    const externalId = `webhook-e2e-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    await post('/webhooks/shopify/customers/data_request', {
      shop_id: 1,
      shop_domain: 'test.myshopify.com',
      customer: { id: externalId },
      data_request: { id: 555 },
    }).expect(200);

    const requests = await prisma.dataSubjectRequest.findMany({
      where: { memberId: member.id },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe('ACCESS');

    const logs = await prisma.auditLog.findMany({
      where: { action: 'member.data_request_received', targetId: member.id },
    });
    expect(logs).toHaveLength(1);
  });

  it('customers/redact deletes the member and leaves a surviving audit record', async () => {
    const externalId = `webhook-e2e-redact-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    await post('/webhooks/shopify/customers/redact', {
      shop_id: 1,
      shop_domain: 'test.myshopify.com',
      customer: { id: externalId },
    }).expect(200);

    const stillExists = await prisma.member.findUnique({
      where: { id: member.id },
    });
    expect(stillExists).toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: { action: 'member.redacted', targetId: member.id },
    });
    expect(logs).toHaveLength(1);
    // The whole point of SetNull on this relation: the log survives, but no
    // longer points at a Member row that doesn't exist anymore.
    expect(logs[0].targetMemberId).toBeNull();
  });

  it('customers/redact for an unknown customer is a safe no-op (200, not a 500 or a thrown error)', async () => {
    await post('/webhooks/shopify/customers/redact', {
      shop_id: 1,
      shop_domain: 'test.myshopify.com',
      customer: { id: 'no-such-customer-id' },
    }).expect(200);
  });
});
