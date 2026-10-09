import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
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

  // Mailchimp-subscriber sync. External calls (Mailchimp's API, Shopify's
  // GraphQL) are mocked — there's no safe way to hit the real audience or
  // create real Shopify customers on every run. Guards, the controller, the
  // background job, member matching and DB writes all run for real.
  describe('/integrations/mailchimp-sync', () => {
    let getSpy: jest.SpyInstance | undefined;
    let postSpy: jest.SpyInstance | undefined;
    let originalAdminToken: Awaited<
      ReturnType<typeof prisma.shopifyAdminToken.findUnique>
    >;
    const run = `${Date.now()}`;
    const email = (name: string) => `mailchimp-e2e-${name}-${run}@example.com`;

    beforeAll(async () => {
      originalAdminToken = await prisma.shopifyAdminToken.findUnique({
        where: { id: 'singleton' },
      });
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
        await prisma.shopifyAdminToken.deleteMany({ where: { id: 'singleton' } });
      }
    });

    afterEach(() => {
      getSpy?.mockRestore();
      postSpy?.mockRestore();
      getSpy = postSpy = undefined;
    });

    function mockMailchimp(
      subscribers: { email: string; first?: string; last?: string }[],
    ) {
      getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          total_items: subscribers.length,
          members: subscribers.map((s) => ({
            email_address: s.email,
            status: 'subscribed',
            merge_fields: { FNAME: s.first, LNAME: s.last },
          })),
        },
      });
    }

    // existing: email -> numeric Shopify id of a customer that already exists.
    function mockShopify(existing: Record<string, string> = {}) {
      let nextId = 9_000_000_000 + Math.floor(Math.random() * 1_000_000);
      postSpy = jest
        .spyOn(axios, 'post')
        .mockImplementation((_url: string, body: unknown) => {
          const { query, variables } = body as {
            query: string;
            variables: { input?: { email: string }; query?: string };
          };
          if (query.includes('customerCreate')) {
            const e = variables.input!.email;
            if (existing[e]) {
              return Promise.resolve({
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
            }
            nextId += 1;
            return Promise.resolve({
              data: {
                data: {
                  customerCreate: {
                    customer: { id: `gid://shopify/Customer/${nextId}` },
                    userErrors: [],
                  },
                },
              },
            });
          }
          const e = /email:"([^"]+)"/.exec(variables.query!)![1];
          return Promise.resolve({
            data: {
              data: {
                customers: {
                  nodes: existing[e]
                    ? [{ id: `gid://shopify/Customer/${existing[e]}`, email: e }]
                    : [],
                },
              },
            },
          });
        });
    }

    async function runSync(cookie: string) {
      await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', cookie)
        .expect(202);
      for (let i = 0; i < 100; i++) {
        const res = await request(app.getHttpServer())
          .get('/integrations/mailchimp-sync')
          .set('Cookie', cookie)
          .expect(200);
        if (res.body.state !== 'running') return res.body;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error('sync did not finish');
    }

    it('401 with no session, 403 for a role without access', async () => {
      await request(app.getHttpServer()).post('/integrations/mailchimp-sync').expect(401);
      await request(app.getHttpServer()).get('/integrations/mailchimp-sync').expect(401);
      const contentManager = await staffCookieFor('Content Manager');
      await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', contentManager)
        .expect(403);
      await request(app.getHttpServer())
        .get('/integrations/mailchimp-sync')
        .set('Cookie', contentManager)
        .expect(403);
    });

    it('adds new subscribers as Newsletter members, matches existing ones without duplicating or downgrading, and audits the run', async () => {
      const paid = await prisma.member.create({
        data: {
          shopifyCustomerId: `${Date.now()}1`,
          email: email('paid'),
          membershipTier: 'FOUNDING',
          isFoundingMember: true,
        },
      });
      const existingShopifyId = `${Date.now()}2`;
      mockMailchimp([
        { email: email('brand-new'), first: 'Brand', last: 'New' },
        { email: email('paid').toUpperCase() },
        { email: email('shopify-only') },
      ]);
      mockShopify({ [email('shopify-only')]: existingShopifyId });

      const status = await runSync(await staffCookieFor('Technical Administrator'));

      expect(status.state).toBe('finished');
      expect(status.result).toEqual({
        totalSubscribers: 3,
        shopifyCustomersCreated: 1,
        membersCreated: 2,
        membersMarkedSubscribed: 1,
        membersMarkedUnsubscribed: expect.any(Number),
        failed: [],
      });

      const brandNew = await prisma.member.findMany({ where: { email: email('brand-new') } });
      expect(brandNew).toHaveLength(1);
      expect(brandNew[0]).toMatchObject({
        membershipTier: 'NEWSLETTER',
        newsletterSubscribed: true,
        firstName: 'Brand',
        lastName: 'New',
      });
      // Stored in the same numeric form the login flow uses, so their first
      // login finds this row instead of creating a second one.
      expect(brandNew[0].shopifyCustomerId).toMatch(/^\d+$/);

      const shopifyOnly = await prisma.member.findMany({ where: { email: email('shopify-only') } });
      expect(shopifyOnly).toHaveLength(1);
      expect(shopifyOnly[0].shopifyCustomerId).toBe(existingShopifyId);

      const paidAfter = await prisma.member.findUniqueOrThrow({ where: { id: paid.id } });
      expect(paidAfter.membershipTier).toBe('FOUNDING');
      expect(paidAfter.newsletterSubscribed).toBe(true);
      // Matched by email, so Shopify was never asked to create them.
      const createdEmails = postSpy!.mock.calls
        .map(([, body]) => (body as { variables: { input?: { email: string } } }).variables.input?.email)
        .filter(Boolean);
      expect(createdEmails).not.toContain(email('paid').toUpperCase());

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'mailchimp.synced' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit!.metadata).toMatchObject({ membersCreated: 2, failed: 0 });
    });

    it('re-running is idempotent: no duplicates, no new Shopify customers', async () => {
      mockMailchimp([{ email: email('brand-new') }, { email: email('paid') }]);
      mockShopify();
      const status = await runSync(await staffCookieFor('Technical Administrator'));
      expect(status.result).toMatchObject({
        shopifyCustomersCreated: 0,
        membersCreated: 0,
        membersMarkedSubscribed: 0,
      });
      expect(await prisma.member.count({ where: { email: email('brand-new') } })).toBe(1);
    });

    it("a synced subscriber's first real login reuses their member record instead of creating a duplicate", async () => {
      const synced = await prisma.member.findFirstOrThrow({ where: { email: email('brand-new') } });
      const members = app.get(MembersService);
      const loggedIn = await members.findOrCreateFromIdentity({
        providerId: 'shopify',
        externalId: synced.shopifyCustomerId,
        email: email('brand-new'),
        firstName: 'Brand',
        lastName: 'New',
      });
      expect(loggedIn.id).toBe(synced.id);
      expect(loggedIn.membershipTier).toBe('NEWSLETTER');
      expect(await prisma.member.count({ where: { email: email('brand-new') } })).toBe(1);
    });

    it('marks members who are no longer subscribed as unsubscribed, without deleting them or touching a paid tier', async () => {
      // Only shopify-only is still subscribed; brand-new and paid unsubscribed.
      mockMailchimp([{ email: email('shopify-only') }]);
      mockShopify();
      const status = await runSync(await staffCookieFor('Technical Administrator'));
      expect(status.result.membersMarkedUnsubscribed).toBeGreaterThanOrEqual(2);

      const brandNew = await prisma.member.findFirstOrThrow({ where: { email: email('brand-new') } });
      expect(brandNew.newsletterSubscribed).toBe(false);
      expect(brandNew.membershipTier).toBe('NEWSLETTER');

      const paid = await prisma.member.findFirstOrThrow({ where: { email: email('paid') } });
      expect(paid.newsletterSubscribed).toBe(false);
      expect(paid.membershipTier).toBe('FOUNDING');

      const shopifyOnly = await prisma.member.findFirstOrThrow({ where: { email: email('shopify-only') } });
      expect(shopifyOnly.newsletterSubscribed).toBe(true);
    });

    it('excludes unsubscribed Newsletter members from the dashboard Newsletter count', async () => {
      const cookie = await staffCookieFor('Super Administrator');
      // Other spec files insert members concurrently — retry until the DB
      // count is stable across the request, then compare exactly.
      for (let attempt = 0; attempt < 5; attempt++) {
        const expected = () =>
          prisma.member.count({
            where: {
              membershipTier: 'NEWSLETTER',
              OR: [{ newsletterSubscribed: null }, { newsletterSubscribed: true }],
            },
          });
        const before = await expected();
        const res = await request(app.getHttpServer())
          .get('/staff-dashboard/stats')
          .set('Cookie', cookie)
          .expect(200);
        const after = await expected();
        if (before !== after) continue;
        expect(res.body.byTier.NEWSLETTER.count).toBe(before);
        return;
      }
      throw new Error('member count never stabilised');
    });

    it('fails cleanly when Mailchimp is unreachable, and does not mark anyone unsubscribed', async () => {
      getSpy = jest
        .spyOn(axios, 'get')
        .mockRejectedValue(new Error('Request failed with status code 404'));
      const status = await runSync(await staffCookieFor('Technical Administrator'));
      expect(status.state).toBe('failed');
      expect(status.error).toMatch(/could not reach mailchimp/i);

      const shopifyOnly = await prisma.member.findFirstOrThrow({ where: { email: email('shopify-only') } });
      expect(shopifyOnly.newsletterSubscribed).toBe(true);
    });

    it('rejects a second run while one is in progress', async () => {
      let release!: () => void;
      getSpy = jest.spyOn(axios, 'get').mockImplementation(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ data: { total_items: 0, members: [] } });
          }),
      );
      mockShopify();
      const cookie = await staffCookieFor('Technical Administrator');
      await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', cookie)
        .expect(202);
      await request(app.getHttpServer())
        .post('/integrations/mailchimp-sync')
        .set('Cookie', cookie)
        .expect(409);
      while (!release) await new Promise((r) => setTimeout(r, 10));
      release();
      for (let i = 0; i < 100; i++) {
        const res = await request(app.getHttpServer())
          .get('/integrations/mailchimp-sync')
          .set('Cookie', cookie);
        if (res.body.state !== 'running') break;
        await new Promise((r) => setTimeout(r, 50));
      }
    });
  });
});
