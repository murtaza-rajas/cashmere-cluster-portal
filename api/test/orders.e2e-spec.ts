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
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const staff = await prisma.staffUser.create({
      data: {
        email: `order-catalog-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
        name: `Test ${roleName}`,
      },
    });
    await prisma.staffRoleAssignment.create({ data: { staffUserId: staff.id, roleId: role.id } });
    const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, { expiresIn: '1h' });
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
    const externalId = `order-catalog-e2e-member-${Date.now()}`;
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
          orderNumber: '#5001',
          totalAmount: '120.00',
          currency: 'NOK',
          status: 'paid',
          orderDate: new Date('2026-09-01'),
        },
        {
          memberId: member.id,
          shopifyOrderId: `${externalId}-order-2`,
          orderNumber: '#5002',
          totalAmount: '340.00',
          currency: 'NOK',
          status: 'paid',
          orderDate: new Date('2026-09-05'),
          lineItems: [{ productId: 'p1', title: 'Cashmere Scarf', variantTitle: 'Navy', quantity: 1, price: '340.00' }],
        },
      ],
    });

    const commerceManagerCookie = await staffCookieFor('Commerce Manager');
    const res = await request(app.getHttpServer())
      .get('/order-catalog')
      .set('Cookie', commerceManagerCookie)
      .expect(200);

    const orderNumbers = res.body.map((o: { orderNumber: string }) => o.orderNumber);
    expect(orderNumbers.indexOf('#5002')).toBeLessThan(orderNumbers.indexOf('#5001'));

    const withLineItems = res.body.find((o: { orderNumber: string }) => o.orderNumber === '#5002');
    expect(withLineItems.member.email).toBe(`${externalId}@example.com`);
    expect(withLineItems.member.firstName).toBe('Order');
    expect(withLineItems.lineItems).toHaveLength(1);
    expect(withLineItems.lineItems[0].title).toBe('Cashmere Scarf');
  });

  it('search filters by order number and by member name/email, without matching other members', async () => {
    const externalId = `order-catalog-e2e-search-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: member.id },
      data: { firstName: 'Searchable', lastName: 'Person' },
    });
    await prisma.memberOrderCache.create({
      data: {
        memberId: member.id,
        shopifyOrderId: `${externalId}-order`,
        orderNumber: '#9999',
        totalAmount: '50.00',
        currency: 'NOK',
        status: 'paid',
        orderDate: new Date(),
      },
    });

    const commerceManagerCookie = await staffCookieFor('Commerce Manager');

    const byOrderNumber = await request(app.getHttpServer())
      .get('/order-catalog?search=9999')
      .set('Cookie', commerceManagerCookie)
      .expect(200);
    expect(byOrderNumber.body).toHaveLength(1);
    expect(byOrderNumber.body[0].orderNumber).toBe('#9999');

    const byName = await request(app.getHttpServer())
      .get('/order-catalog?search=Searchable')
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
