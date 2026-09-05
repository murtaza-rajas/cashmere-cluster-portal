import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

// GET /members/me/collection specifically — exercises the real HTTP layer (auth
// guard + controller + service) together, not just MembersService in isolation.
describe('GET /members/me/collection (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
  });

  afterAll(async () => {
    await app.close();
  });

  function sessionCookieFor(memberId: string): string {
    const token = jwt.sign({ sub: memberId }, process.env.JWT_SECRET!, {
      expiresIn: '1h',
    });
    return `clc_session=${token}`;
  }

  it('401s with no session', async () => {
    await request(app.getHttpServer())
      .get('/members/me/collection')
      .expect(401);
  });

  it("flattens line items across a member's orders, newest order first, no items from other members", async () => {
    const externalId = `collection-e2e-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const otherExternalId = `collection-e2e-other-${Date.now()}`;
    const otherMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId: otherExternalId,
      email: `${otherExternalId}@example.com`,
    });

    await prisma.memberOrderCache.createMany({
      data: [
        {
          memberId: member.id,
          shopifyOrderId: `${externalId}-order-1`,
          orderNumber: '#1',
          totalAmount: '99.50',
          currency: 'USD',
          status: 'paid',
          orderDate: new Date('2026-01-01'),
          lineItems: [
            {
              productId: '1',
              title: 'Older Scarf',
              variantTitle: null,
              quantity: 1,
              price: '99.50',
            },
          ],
        },
        {
          memberId: member.id,
          shopifyOrderId: `${externalId}-order-2`,
          orderNumber: '#2',
          totalAmount: '150.00',
          currency: 'USD',
          status: 'paid',
          orderDate: new Date('2026-02-01'),
          lineItems: [
            {
              productId: '2',
              title: 'Newer Sweater',
              variantTitle: 'Grey',
              quantity: 1,
              price: '150.00',
            },
          ],
        },
        {
          // No line items yet — matches a real order synced before this field existed.
          memberId: member.id,
          shopifyOrderId: `${externalId}-order-3`,
          orderNumber: '#3',
          totalAmount: '10.00',
          currency: 'USD',
          status: 'paid',
          orderDate: new Date('2026-03-01'),
        },
        {
          // Belongs to a different member — must never appear in this member's collection.
          memberId: otherMember.id,
          shopifyOrderId: `${otherExternalId}-order-1`,
          orderNumber: '#99',
          totalAmount: '500.00',
          currency: 'USD',
          status: 'paid',
          orderDate: new Date('2026-02-15'),
          lineItems: [
            {
              productId: '99',
              title: "Someone Else's Coat",
              variantTitle: null,
              quantity: 1,
              price: '500.00',
            },
          ],
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/collection')
      .set('Cookie', sessionCookieFor(member.id))
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Newer Sweater');
    expect(res.body[0].orderNumber).toBe('#2');
    expect(res.body[1].title).toBe('Older Scarf');
    expect(
      res.body.some(
        (item: { title: string }) => item.title === "Someone Else's Coat",
      ),
    ).toBe(false);
  });

  it('returns an empty list for a member with no synced orders', async () => {
    const externalId = `collection-e2e-empty-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/collection')
      .set('Cookie', sessionCookieFor(member.id))
      .expect(200);

    expect(res.body).toEqual([]);
  });
});

// GET/POST /members/me/data-requests — the self-service GDPR access-request
// entry point (see DataSubjectRequestsService.createFromMember). Previously the
// only way a DataSubjectRequest ever got created was Shopify's
// customers/data_request webhook; this is the first member-initiated path.
describe('GET/POST /members/me/data-requests (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
  });

  afterAll(async () => {
    await app.close();
  });

  function sessionCookieFor(memberId: string): string {
    const token = jwt.sign({ sub: memberId }, process.env.JWT_SECRET!, {
      expiresIn: '1h',
    });
    return `clc_session=${token}`;
  }

  it('401s with no session, both routes', async () => {
    await request(app.getHttpServer())
      .get('/members/me/data-requests')
      .expect(401);
    await request(app.getHttpServer())
      .post('/members/me/data-requests')
      .expect(401);
  });

  it('POST creates a PENDING ACCESS request, visible via GET, with an audit log entry', async () => {
    const externalId = `data-request-e2e-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const cookie = sessionCookieFor(member.id);

    const created = await request(app.getHttpServer())
      .post('/members/me/data-requests')
      .set('Cookie', cookie)
      .expect(201);

    expect(created.body.type).toBe('ACCESS');
    expect(created.body.status).toBe('PENDING');
    expect(created.body.memberId).toBe(member.id);

    const list = await request(app.getHttpServer())
      .get('/members/me/data-requests')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);

    const auditEntries = await prisma.auditLog.findMany({
      where: {
        action: 'member.data_request_created',
        targetId: created.body.id,
      },
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].targetMemberId).toBe(member.id);
    expect(auditEntries[0].actorStaffUserId).toBeNull();
  });

  it('POSTing again while one is already pending returns the same request, not a duplicate', async () => {
    const externalId = `data-request-e2e-dup-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const cookie = sessionCookieFor(member.id);

    const first = await request(app.getHttpServer())
      .post('/members/me/data-requests')
      .set('Cookie', cookie)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/members/me/data-requests')
      .set('Cookie', cookie)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const all = await prisma.dataSubjectRequest.findMany({
      where: { memberId: member.id },
    });
    expect(all).toHaveLength(1);
  });

  it("GET only returns the requesting member's own requests, never another member's", async () => {
    const externalId = `data-request-e2e-priv-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const otherExternalId = `data-request-e2e-priv-other-${Date.now()}`;
    const otherMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId: otherExternalId,
      email: `${otherExternalId}@example.com`,
    });

    await request(app.getHttpServer())
      .post('/members/me/data-requests')
      .set('Cookie', sessionCookieFor(otherMember.id))
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/members/me/data-requests')
      .set('Cookie', sessionCookieFor(member.id))
      .expect(200);

    expect(res.body).toEqual([]);
  });
});

// GET/POST/DELETE /members/me/wishlist — see WishlistService. This is our side
// of the client's confirmed Wishlist flow (PROJECT_TRACKER.md Section 3c); the
// actual storefront "Add to Wishlist" click isn't wired up yet (separate,
// unresolved integration design), but this endpoint is what it would call.
describe('GET/POST/DELETE /members/me/wishlist (e2e)', () => {
  let app: INestApplication<App>;
  let members: MembersService;

  beforeAll(async () => {
    app = await createTestApp();
    members = app.get(MembersService);
  });

  afterAll(async () => {
    await app.close();
  });

  function sessionCookieFor(memberId: string): string {
    const token = jwt.sign({ sub: memberId }, process.env.JWT_SECRET!, {
      expiresIn: '1h',
    });
    return `clc_session=${token}`;
  }

  it('401s with no session, all three routes', async () => {
    await request(app.getHttpServer()).get('/members/me/wishlist').expect(401);
    await request(app.getHttpServer()).post('/members/me/wishlist').expect(401);
    await request(app.getHttpServer())
      .delete('/members/me/wishlist/does-not-exist')
      .expect(401);
  });

  it('400s on POST with no title', async () => {
    const externalId = `wishlist-e2e-invalid-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    await request(app.getHttpServer())
      .post('/members/me/wishlist')
      .set('Cookie', sessionCookieFor(member.id))
      .send({ shopifyProductId: '123' })
      .expect(400);
  });

  it('adds an item, lists it, and a second identical add does not duplicate it', async () => {
    const externalId = `wishlist-e2e-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const cookie = sessionCookieFor(member.id);

    const created = await request(app.getHttpServer())
      .post('/members/me/wishlist')
      .set('Cookie', cookie)
      .send({
        shopifyProductId: '456',
        title: 'Cashmere Wrap',
        variantTitle: 'Camel',
        price: '180.00',
      })
      .expect(201);

    expect(created.body.title).toBe('Cashmere Wrap');
    expect(created.body.memberId).toBe(member.id);

    const duplicate = await request(app.getHttpServer())
      .post('/members/me/wishlist')
      .set('Cookie', cookie)
      .send({ shopifyProductId: '456', title: 'Cashmere Wrap' })
      .expect(201);
    expect(duplicate.body.id).toBe(created.body.id);

    const list = await request(app.getHttpServer())
      .get('/members/me/wishlist')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it("DELETE removes the item; a second member cannot delete another member's item", async () => {
    const externalId = `wishlist-e2e-del-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const otherExternalId = `wishlist-e2e-del-other-${Date.now()}`;
    const otherMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId: otherExternalId,
      email: `${otherExternalId}@example.com`,
    });

    const created = await request(app.getHttpServer())
      .post('/members/me/wishlist')
      .set('Cookie', sessionCookieFor(member.id))
      .send({ shopifyProductId: '789', title: 'Cashmere Beanie' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/members/me/wishlist/${created.body.id}`)
      .set('Cookie', sessionCookieFor(otherMember.id))
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/members/me/wishlist/${created.body.id}`)
      .set('Cookie', sessionCookieFor(member.id))
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/members/me/wishlist')
      .set('Cookie', sessionCookieFor(member.id))
      .expect(200);
    expect(list.body).toEqual([]);
  });
});
