import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHmac } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

// Exercises the real HTTP layer (raw-body/HMAC wiring), same reasoning as
// shopify-webhooks.e2e-spec.ts — this is a separate file because these routes
// (orders/create, orders/updated) aren't part of the GDPR compliance set that
// file is scoped to.
describe('Shopify order-sync webhooks (e2e)', () => {
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

  function post(path: string, payload: object) {
    const rawBody = JSON.stringify(payload);
    return request(app.getHttpServer())
      .post(path)
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', sign(rawBody))
      .send(rawBody);
  }

  it('orders/create writes a new MemberOrderCache row for a known customer', async () => {
    const externalId = `order-webhook-e2e-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now();

    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#5001',
      total_price: '129.50',
      currency: 'USD',
      financial_status: 'pending',
      created_at: '2026-08-01T00:00:00Z',
      customer: { id: externalId },
    }).expect(200);

    const order = await prisma.memberOrderCache.findUnique({
      where: { shopifyOrderId: String(shopifyOrderId) },
    });
    expect(order).not.toBeNull();
    expect(order!.memberId).toBe(member.id);
    expect(order!.orderNumber).toBe('#5001');
    expect(order!.status).toBe('pending');
    expect(order!.totalAmount.toString()).toBe('129.5');
  });

  it('orders/updated on an existing order updates status/total rather than duplicating it', async () => {
    const externalId = `order-webhook-e2e-update-${Date.now()}`;
    await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now() + 1;

    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#5002',
      total_price: '50.00',
      currency: 'USD',
      financial_status: 'pending',
      created_at: '2026-08-01T00:00:00Z',
      customer: { id: externalId },
    }).expect(200);

    await post('/webhooks/shopify/orders/updated', {
      id: shopifyOrderId,
      name: '#5002',
      total_price: '50.00',
      currency: 'USD',
      financial_status: 'paid',
      created_at: '2026-08-01T00:00:00Z',
      customer: { id: externalId },
    }).expect(200);

    const orders = await prisma.memberOrderCache.findMany({
      where: { shopifyOrderId: String(shopifyOrderId) },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('paid');
  });

  it('orders/create captures line items for My Collection', async () => {
    const externalId = `order-webhook-e2e-lineitems-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now() + 10;

    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#5005',
      total_price: '249.00',
      currency: 'USD',
      financial_status: 'paid',
      created_at: '2026-08-01T00:00:00Z',
      customer: { id: externalId },
      line_items: [
        { id: 1, product_id: 111, title: 'Cashmere Scarf', variant_title: 'Charcoal', quantity: 2, price: '99.50' },
        { id: 2, product_id: null, title: 'Gift Wrapping', variant_title: null, quantity: 1, price: '10.00' },
      ],
    }).expect(200);

    const order = await prisma.memberOrderCache.findUnique({
      where: { shopifyOrderId: String(shopifyOrderId) },
    });
    expect(order!.memberId).toBe(member.id);
    expect(order!.lineItems).toEqual([
      { productId: '111', title: 'Cashmere Scarf', variantTitle: 'Charcoal', quantity: 2, price: '99.50' },
      { productId: null, title: 'Gift Wrapping', variantTitle: null, quantity: 1, price: '10.00' },
    ]);
  });

  it('an order for an unknown customer is a safe no-op (200, no row written)', async () => {
    const shopifyOrderId = Date.now() + 2;
    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#5003',
      total_price: '10.00',
      currency: 'USD',
      financial_status: 'paid',
      created_at: '2026-08-01T00:00:00Z',
      customer: { id: 'no-such-customer-id' },
    }).expect(200);

    const order = await prisma.memberOrderCache.findUnique({
      where: { shopifyOrderId: String(shopifyOrderId) },
    });
    expect(order).toBeNull();
  });

  it('a guest-checkout order (no customer) is a safe no-op', async () => {
    const shopifyOrderId = Date.now() + 3;
    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#5004',
      total_price: '10.00',
      currency: 'USD',
      financial_status: 'paid',
      created_at: '2026-08-01T00:00:00Z',
      customer: null,
    }).expect(200);

    const order = await prisma.memberOrderCache.findUnique({
      where: { shopifyOrderId: String(shopifyOrderId) },
    });
    expect(order).toBeNull();
  });
});

// Auto-activation-on-payment (Milestone 4, 2026-10-07) — a paid order for a
// real membership product sets the member's tier/term/dates. Uses the real
// MembershipLevel.shopifyProductId mappings already set in the dev DB
// (matching production exactly), not fixture IDs, so this exercises the
// actual live mapping, not an approximation of it.
describe('Shopify order-sync webhooks — auto-activation-on-payment (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;
  let secret: string;
  let foundingProductId: string;
  let annualProductId: string;

  beforeAll(async () => {
    app = await createTestApp({ rawBody: true });
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
    secret = process.env.SHOPIFY_WEBHOOK_SECRET!;

    const founding = await prisma.membershipLevel.findUniqueOrThrow({ where: { tier: 'FOUNDING' } });
    const annual = await prisma.membershipLevel.findUniqueOrThrow({ where: { tier: 'ANNUAL' } });
    if (!founding.shopifyProductId || !annual.shopifyProductId) {
      throw new Error(
        'FOUNDING/ANNUAL MembershipLevel rows have no shopifyProductId set — run the mapping script before this suite.',
      );
    }
    foundingProductId = founding.shopifyProductId;
    annualProductId = annual.shopifyProductId;
  });

  afterAll(async () => {
    await app.close();
  });

  function sign(rawBody: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('base64');
  }

  function post(path: string, payload: object) {
    const rawBody = JSON.stringify(payload);
    return request(app.getHttpServer())
      .post(path)
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', sign(rawBody))
      .send(rawBody);
  }

  it('a paid order for the real Founding product activates the member correctly', async () => {
    const externalId = `activation-e2e-founding-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now() + 100;

    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#6001',
      total_price: '11000.00',
      currency: 'NOK',
      financial_status: 'paid',
      created_at: '2026-10-07T00:00:00Z',
      customer: { id: externalId },
      line_items: [
        { id: 1, product_id: Number(foundingProductId), title: 'Founding Membership', variant_title: null, quantity: 1, price: '11000.00' },
      ],
    }).expect(200);

    const updated = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated.membershipTier).toBe('FOUNDING');
    expect(updated.isFoundingMember).toBe(true);
    expect(updated.termLengthMonths).toBe(60);
    expect(updated.originatingShopifyOrderId).toBe(String(shopifyOrderId));
    expect(updated.membershipStartDate?.toISOString()).toBe('2026-10-07T00:00:00.000Z');
    expect(updated.membershipEndDate?.toISOString()).toBe('2031-10-07T00:00:00.000Z');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'member.tier_activated', targetMemberId: member.id },
    });
    expect(audit).not.toBeNull();
    expect((audit!.metadata as { tier: string }).tier).toBe('FOUNDING');
  });

  it('a pending order for a membership product does not activate anything yet', async () => {
    const externalId = `activation-e2e-pending-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now() + 101;

    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#6002',
      total_price: '300.00',
      currency: 'NOK',
      financial_status: 'pending',
      created_at: '2026-10-07T00:00:00Z',
      customer: { id: externalId },
      line_items: [
        { id: 1, product_id: Number(annualProductId), title: 'Annual Membership', variant_title: null, quantity: 1, price: '300.00' },
      ],
    }).expect(200);

    const unchanged = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(unchanged.membershipTier).toBe('NEWSLETTER');
    expect(unchanged.originatingShopifyOrderId).toBeNull();
  });

  it('orders/updated transitioning pending → paid activates the member on the later delivery', async () => {
    const externalId = `activation-e2e-transition-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now() + 102;
    const orderBase = {
      id: shopifyOrderId,
      name: '#6003',
      total_price: '300.00',
      currency: 'NOK',
      created_at: '2026-10-07T00:00:00Z',
      customer: { id: externalId },
      line_items: [
        { id: 1, product_id: Number(annualProductId), title: 'Annual Membership', variant_title: null, quantity: 1, price: '300.00' },
      ],
    };

    await post('/webhooks/shopify/orders/create', { ...orderBase, financial_status: 'pending' }).expect(200);
    await post('/webhooks/shopify/orders/updated', { ...orderBase, financial_status: 'paid' }).expect(200);

    const updated = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated.membershipTier).toBe('ANNUAL');
    expect(updated.termLengthMonths).toBe(12);
    expect(updated.isFoundingMember).toBe(false);
  });

  it('a paid order for a non-membership product does not touch the member tier', async () => {
    const externalId = `activation-e2e-unrelated-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const shopifyOrderId = Date.now() + 103;

    await post('/webhooks/shopify/orders/create', {
      id: shopifyOrderId,
      name: '#6004',
      total_price: '99.00',
      currency: 'NOK',
      financial_status: 'paid',
      created_at: '2026-10-07T00:00:00Z',
      customer: { id: externalId },
      line_items: [
        { id: 1, product_id: 999999999, title: 'Unrelated Product', variant_title: null, quantity: 1, price: '99.00' },
      ],
    }).expect(200);

    const unchanged = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(unchanged.membershipTier).toBe('NEWSLETTER');
    expect(unchanged.originatingShopifyOrderId).toBeNull();
  });
});
