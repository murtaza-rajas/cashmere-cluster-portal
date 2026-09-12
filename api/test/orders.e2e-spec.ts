import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

// Shopify & Orders admin view (Milestone 5) — Commerce Manager, a role
// seeded since Milestone 1 with no page of its own until this. Read-only,
// cross-member — GET /order-catalog reads real MemberOrderCache rows (the
// order-sync webhooks' own cache table), searchable by order number or the
// member's name/email.
describe('Order catalog (e2e, staff-facing)', () => {
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

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `order-catalog-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('GET /order-catalog: 401 with no session, 403 for a role without access, 200 for Commerce Manager', async () => {
    await request(app.getHttpServer()).get('/order-catalog').expect(401);

    await request(app.getHttpServer())
      .get('/order-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .expect(403);

    await request(app.getHttpServer())
      .get('/order-catalog')
      .set('Cookie', await staffCookieFor('Commerce Manager'))
      .expect(200);
  });

  it('lists real orders across every member, newest first, with the member relation included', async () => {
    // Order numbers carry this run's own timestamp — a fixed '#5001'/
    // '#5002' (the original version of this test) accumulates one pair of
    // rows per repeated full-suite run against a persistent dev DB, and
    // `.find(o => o.orderNumber === '#5002')` below would then grab
    // whichever run's row the query happened to return first, not
    // necessarily this run's own. Found live (2026-09-12) the same way as
    // the search test below.
    const unique = Date.now();
    const orderNumber1 = `#${unique}1`;
    const orderNumber2 = `#${unique}2`;
    const externalId = `order-catalog-e2e-member-${unique}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: member.id },
      data: { firstName: 'Order', lastName: 'Catalog' },
    });

    await prisma.memberOrderCache.createMany({
      data: [
        {
          memberId: member.id,
          shopifyOrderId: `${externalId}-order-1`,
          orderNumber: orderNumber1,
          totalAmount: '120.00',
          currency: 'NOK',
          status: 'paid',
          orderDate: new Date('2026-09-01'),
        },
        {
          memberId: member.id,
          shopifyOrderId: `${externalId}-order-2`,
          orderNumber: orderNumber2,
          totalAmount: '340.00',
          currency: 'NOK',
          status: 'paid',
          orderDate: new Date('2026-09-05'),
          lineItems: [
            {
              productId: 'p1',
              title: 'Cashmere Scarf',
              variantTitle: 'Navy',
              quantity: 1,
              price: '340.00',
            },
          ],
        },
      ],
    });

    const commerceManagerCookie = await staffCookieFor('Commerce Manager');
    const res = await request(app.getHttpServer())
      .get('/order-catalog')
      .set('Cookie', commerceManagerCookie)
      .expect(200);

    const orderNumbers = res.body.map(
      (o: { orderNumber: string }) => o.orderNumber,
    );
    expect(orderNumbers.indexOf(orderNumber2)).toBeLessThan(
      orderNumbers.indexOf(orderNumber1),
    );

    const withLineItems = res.body.find(
      (o: { orderNumber: string }) => o.orderNumber === orderNumber2,
    );
    expect(withLineItems.member.email).toBe(`${externalId}@example.com`);
    expect(withLineItems.member.firstName).toBe('Order');
    expect(withLineItems.lineItems).toHaveLength(1);
    expect(withLineItems.lineItems[0].title).toBe('Cashmere Scarf');
  });

  it('search filters by order number and by member name/email, without matching other members', async () => {
    // Both the order number and the searchable name carry this run's own
    // timestamp — a fixed '#9999'/'Searchable' (the original version of
    // this test) accumulates one row per repeated full-suite run in the
    // same dev DB, since nothing here ever cleans up after itself, and a
    // second run's "exactly 1 match" assertion then fails against its own
    // and every prior run's row. Found live (2026-09-12): this test passed
    // in isolation but failed the moment the full suite had been run more
    // than once against a persistent dev database.
    const unique = Date.now();
    const externalId = `order-catalog-e2e-search-${unique}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: member.id },
      data: { firstName: `Searchable${unique}`, lastName: 'Person' },
    });
    await prisma.memberOrderCache.create({
      data: {
        memberId: member.id,
        shopifyOrderId: `${externalId}-order`,
        orderNumber: `#${unique}`,
        totalAmount: '50.00',
        currency: 'NOK',
        status: 'paid',
        orderDate: new Date(),
      },
    });

    const commerceManagerCookie = await staffCookieFor('Commerce Manager');

    const byOrderNumber = await request(app.getHttpServer())
      .get(`/order-catalog?search=${unique}`)
      .set('Cookie', commerceManagerCookie)
      .expect(200);
    expect(byOrderNumber.body).toHaveLength(1);
    expect(byOrderNumber.body[0].orderNumber).toBe(`#${unique}`);

    const byName = await request(app.getHttpServer())
      .get(`/order-catalog?search=Searchable${unique}`)
      .set('Cookie', commerceManagerCookie)
      .expect(200);
    expect(byName.body).toHaveLength(1);
    expect(byName.body[0].member.id).toBe(member.id);

    const noMatch = await request(app.getHttpServer())
      .get('/order-catalog?search=definitely-does-not-exist-anywhere')
      .set('Cookie', commerceManagerCookie)
      .expect(200);
    expect(noMatch.body).toEqual([]);
  });
});
