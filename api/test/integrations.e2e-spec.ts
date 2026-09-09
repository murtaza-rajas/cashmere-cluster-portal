import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// Integrations & Settings (Milestone 5): a read-only status view at
// /integrations/status (Technical Administrator — see the controller's
// comment). Every field is a real signal (env presence, DB connectivity,
// real timestamps from tables the actual webhooks write to) rather than a
// simulated "connected" state, so these tests assert against real inserts,
// same discipline as reports.e2e-spec.ts — before/after deltas, not exact
// initial-state assumptions, since other specs run concurrently against the
// same dev DB.
describe('Integrations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `integrations-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
        name: `Test ${roleName}`,
      },
    });
    await prisma.staffRoleAssignment.create({
      data: { staffUserId: staff.id, roleId: role.id },
    });
    const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, {
      expiresIn: '1h',
    });
    return `clc_staff_session=${token}`;
  }

  it('GET /integrations/status: 401 with no session, 403 for a role without access, 200 with the real shape for Technical Administrator', async () => {
    await request(app.getHttpServer()).get('/integrations/status').expect(401);

    await request(app.getHttpServer())
      .get('/integrations/status')
      .set('Cookie', await staffCookieFor('Content Manager'))
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/integrations/status')
      .set('Cookie', await staffCookieFor('Technical Administrator'))
      .expect(200);

    expect(res.body.database.healthy).toBe(true);
    expect(res.body.mailchimp).toEqual({ built: false });
    expect(res.body.cms).toEqual({ built: false });
    expect(res.body.shopify.webhookEndpoints).toEqual(
      expect.arrayContaining([
        '/webhooks/shopify/orders/create',
        '/webhooks/shopify/orders/updated',
        '/webhooks/shopify/customers/data_request',
        '/webhooks/shopify/customers/redact',
        '/webhooks/shopify/shop/redact',
      ]),
    );
    expect(typeof res.body.shopify.oauthConfigured).toBe('boolean');
    expect(typeof res.body.shopify.webhookSecretConfigured).toBe('boolean');
  });

  it('GET /integrations/status reflects a real new order webhook write', async () => {
    const technicalAdminCookie = await staffCookieFor(
      'Technical Administrator',
    );
    const member = await prisma.member.create({
      data: {
        shopifyCustomerId: `integrations-e2e-order-${Date.now()}`,
        email: `integrations-e2e-order-${Date.now()}@example.com`,
        membershipTier: 'ANNUAL',
      },
    });
    const order = await prisma.memberOrderCache.create({
      data: {
        memberId: member.id,
        shopifyOrderId: `integrations-e2e-order-${Date.now()}`,
        orderNumber: '#TEST-INTEGRATIONS',
        totalAmount: '10.00',
        currency: 'USD',
        status: 'paid',
        orderDate: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/integrations/status')
      .set('Cookie', technicalAdminCookie)
      .expect(200);

    // >= rather than an exact match to our own row's timestamp: another spec
    // file's order creation running in a parallel Jest worker could write a
    // slightly newer row in the gap between our insert and this request —
    // this only needs to prove our own write is reflected, not that it's the
    // single most recent one at the exact instant of the request.
    expect(
      new Date(res.body.shopify.lastOrderWebhookAt).getTime(),
    ).toBeGreaterThanOrEqual(order.updatedAt.getTime());
  });

  it('GET /integrations/status reflects a real new GDPR webhook-sourced request', async () => {
    const technicalAdminCookie = await staffCookieFor(
      'Technical Administrator',
    );
    const member = await prisma.member.create({
      data: {
        shopifyCustomerId: `integrations-e2e-gdpr-${Date.now()}`,
        email: `integrations-e2e-gdpr-${Date.now()}@example.com`,
        membershipTier: 'NEWSLETTER',
      },
    });
    const dsr = await prisma.dataSubjectRequest.create({
      data: {
        memberId: member.id,
        type: 'ACCESS',
        sourceShopifyWebhookId: `integrations-e2e-webhook-${Date.now()}`,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/integrations/status')
      .set('Cookie', technicalAdminCookie)
      .expect(200);

    expect(
      new Date(res.body.shopify.lastGdprWebhookAt).getTime(),
    ).toBeGreaterThanOrEqual(dsr.requestedAt.getTime());
  });
});
