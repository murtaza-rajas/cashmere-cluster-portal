import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
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
    // Built 2026-10-08 (MailchimpService) — presence-only booleans, same
    // reasoning as shopify.oauthConfigured below, not a fabricated
    // "connected" status.
    expect(res.body.mailchimp.built).toBe(true);
    expect(typeof res.body.mailchimp.apiKeyConfigured).toBe('boolean');
    expect(typeof res.body.mailchimp.audienceIdConfigured).toBe('boolean');
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

  // Mailchimp-subscriber sync (2026-10-08) — the external calls (Mailchimp's
  // own API, Shopify's customerCreate) are mocked here, not hit for real:
  // there's no safe way to run this against the real Mailchimp audience or
  // create real Shopify customers on every test run. Everything else —
  // guards, the controller, MailchimpService's own matching/counting logic,
  // the audit trail — runs for real against this test's real app/DB, same as
  // every other e2e test in this suite.
  describe('POST /integrations/mailchimp-sync', () => {
    let getSpy: jest.SpyInstance;
    let postSpy: jest.SpyInstance;
    let originalAdminToken: Awaited<
      ReturnType<typeof prisma.shopifyAdminToken.findUnique>
    >;

    beforeAll(async () => {
      // Captures whatever was there before (there shouldn't be one in local
      // dev, but this environment's dev DB is shared across spec files
      // running concurrently, so don't assume) — restored in afterAll rather
      // than just deleted, same reasoning as membership-levels.e2e-spec.ts's
      // own restore-after-test pattern.
      originalAdminToken = await prisma.shopifyAdminToken.findUnique({
        where: { id: 'singleton' },
      });
      // A permanent (no-expiry) token, matching this app's real Custom
      // Distribution Shopify app — see ShopifyAdminAuthService's own comment
      // on why expiry can be null.
      await prisma.shopifyAdminToken.upsert({
        where: { id: 'singleton' },
        update: {
          accessToken: 'test-admin-token',
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
        },
        create: {
          id: 'singleton',
          accessToken: 'test-admin-token',
          scope: 'write_customers',
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
        },
      });
    });

    afterAll(async () => {
      if (originalAdminToken) {
        await prisma.shopifyAdminToken.update({
          where: { id: 'singleton' },
          data: originalAdminToken,
        });
      } else {
        await prisma.shopifyAdminToken.deleteMany({
          where: { id: 'singleton' },
        });
      }
    });

    afterEach(() => {
      getSpy?.mockRestore();
      postSpy?.mockRestore();
    });

    it('401 with no session, 403 for a role without access', async () => {
      await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .expect(401);

      await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', await staffCookieFor('Content Manager'))
        .expect(403);
    });

    it('creates a Shopify customer for a new subscriber, skips one that already exists, and writes an audit entry', async () => {
      getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          total_items: 2,
          members: [
            {
              email_address: 'new-subscriber@example.com',
              status: 'subscribed',
              merge_fields: { FNAME: 'New', LNAME: 'Subscriber' },
            },
            {
              email_address: 'existing-customer@example.com',
              status: 'subscribed',
              merge_fields: {},
            },
          ],
        },
      });

      postSpy = jest
        .spyOn(axios, 'post')
        .mockResolvedValueOnce({
          data: {
            data: {
              customerCreate: {
                customer: { id: 'gid://shopify/Customer/1' },
                userErrors: [],
              },
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: {
              customerCreate: {
                customer: null,
                userErrors: [
                  { field: ['email'], message: 'Email has already been taken' },
                ],
              },
            },
          },
        });

      const technicalAdminCookie = await staffCookieFor(
        'Technical Administrator',
      );
      const res = await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', technicalAdminCookie)
        .expect(201);

      expect(res.body).toEqual({
        totalSubscribers: 2,
        created: 1,
        alreadyExisted: 1,
        failed: [],
      });

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'mailchimp.synced' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.metadata).toMatchObject({
        totalSubscribers: 2,
        created: 1,
        alreadyExisted: 1,
        failedCount: 0,
      });
    });

    it('reports a genuine Shopify error as failed rather than silently swallowing it', async () => {
      getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          total_items: 1,
          members: [
            {
              email_address: 'broken@example.com',
              status: 'subscribed',
              merge_fields: {},
            },
          ],
        },
      });
      postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          data: {
            customerCreate: {
              customer: null,
              userErrors: [{ field: ['phone'], message: 'Phone is invalid' }],
            },
          },
        },
      });

      const technicalAdminCookie = await staffCookieFor(
        'Technical Administrator',
      );
      const res = await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', technicalAdminCookie)
        .expect(201);

      expect(res.body.created).toBe(0);
      expect(res.body.alreadyExisted).toBe(0);
      expect(res.body.failed).toEqual([
        { email: 'broken@example.com', reason: 'Phone is invalid' },
      ]);
    });

    // Real bug found 2026-10-08 live-testing the sync button locally against
    // the real Mailchimp API with a placeholder audience ID: a total failure
    // to list members (bad audience ID, bad API key, Mailchimp down) was
    // uncaught and surfaced as NestJS's generic masked 500 "Internal server
    // error" — useless on the Integrations page, which displays this
    // message directly to staff. Fixed with the same BadGatewayException
    // pattern ShopifyIdentityProvider.discover() already uses for its own
    // external-call failures.
    it('surfaces a clean error when Mailchimp itself cannot be reached at all, rather than a masked 500', async () => {
      getSpy = jest.spyOn(axios, 'get').mockRejectedValue(
        Object.assign(new Error('Request failed with status code 404'), {
          isAxiosError: true,
          response: { status: 404, data: { title: 'Resource Not Found' } },
        }),
      );

      const technicalAdminCookie = await staffCookieFor(
        'Technical Administrator',
      );
      const res = await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', technicalAdminCookie)
        .expect(502);

      expect(res.body.message).toMatch(/could not reach mailchimp/i);
    });
  });
});
