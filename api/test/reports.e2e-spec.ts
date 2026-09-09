import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// Reports & Analytics (Milestone 5): read-only KPI endpoints at /reports/*
// (Analytics Viewer — see reports.controller.ts's comment). The dev database
// already has a lot of real accumulated history from other e2e specs, so
// these tests can't assert exact totals — instead each one creates its own
// uniquely-marked row and asserts the result reflects that specific addition
// (a delta or an exact-match on a value no other test could produce), same
// discipline as every other e2e spec in this suite.
describe('Reports (e2e)', () => {
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
        email: `reports-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('GET /reports/members/totals: 401 with no session, 403 for a role without access, 200 reflecting a real new member', async () => {
    await request(app.getHttpServer())
      .get('/reports/members/totals')
      .expect(401);

    await request(app.getHttpServer())
      .get('/reports/members/totals')
      .set('Cookie', await staffCookieFor('Content Manager'))
      .expect(403);

    const analyticsViewerCookie = await staffCookieFor('Analytics Viewer');
    const before = await request(app.getHttpServer())
      .get('/reports/members/totals')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    const activeBefore = before.body.byStatus.ACTIVE ?? 0;

    await prisma.member.create({
      data: {
        shopifyCustomerId: `reports-e2e-totals-${Date.now()}`,
        email: `reports-e2e-totals-${Date.now()}@example.com`,
        membershipTier: 'NEWSLETTER',
      },
    });

    const after = await request(app.getHttpServer())
      .get('/reports/members/totals')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    // >= rather than exact +1: this is a global aggregate with no
    // distinguishing marker, so another spec file's member creation running
    // in a parallel Jest worker against the same dev DB can also land here —
    // this only needs to prove our own insert was counted.
    expect(after.body.byStatus.ACTIVE).toBeGreaterThanOrEqual(activeBefore + 1);
    expect(after.body.total).toBeGreaterThanOrEqual(before.body.total + 1);
  });

  it('GET /reports/members/tiers reflects a real new Mongolia tier member and a real new Founding member', async () => {
    const analyticsViewerCookie = await staffCookieFor('Analytics Viewer');
    const before = await request(app.getHttpServer())
      .get('/reports/members/tiers')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    const mongoliaBefore = before.body.byTier.MONGOLIA ?? 0;
    const foundingBefore = before.body.foundingMemberCount;

    await prisma.member.create({
      data: {
        shopifyCustomerId: `reports-e2e-tiers-mn-${Date.now()}`,
        email: `reports-e2e-tiers-mn-${Date.now()}@example.com`,
        membershipTier: 'MONGOLIA',
        region: 'MONGOLIA',
      },
    });
    await prisma.member.create({
      data: {
        shopifyCustomerId: `reports-e2e-tiers-founding-${Date.now()}`,
        email: `reports-e2e-tiers-founding-${Date.now()}@example.com`,
        membershipTier: 'FOUNDING',
        isFoundingMember: true,
      },
    });

    const after = await request(app.getHttpServer())
      .get('/reports/members/tiers')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    expect(after.body.byTier.MONGOLIA).toBe(mongoliaBefore + 1);
    expect(after.body.foundingMemberCount).toBe(foundingBefore + 1);
  });

  it('GET /reports/members/new reflects a real new member in the current week bucket', async () => {
    const analyticsViewerCookie = await staffCookieFor('Analytics Viewer');
    const before = await request(app.getHttpServer())
      .get('/reports/members/new?period=week&periods=4')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    expect(before.body).toHaveLength(4);
    const currentBucketBefore = before.body[before.body.length - 1].count;

    await prisma.member.create({
      data: {
        shopifyCustomerId: `reports-e2e-new-${Date.now()}`,
        email: `reports-e2e-new-${Date.now()}@example.com`,
        membershipTier: 'NEWSLETTER',
      },
    });

    const after = await request(app.getHttpServer())
      .get('/reports/members/new?period=week&periods=4')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    // >= rather than an exact +1: unlike the tier/currency-filtered tests
    // below, "current week" has no distinguishing marker, so another spec's
    // member creation landing in the same bucket (Jest runs spec files in
    // parallel workers against the same dev DB) is real, expected noise —
    // this only needs to prove our own insert was counted, not that it was
    // the only one.
    expect(after.body[after.body.length - 1].count).toBeGreaterThanOrEqual(
      currentBucketBefore + 1,
    );
  });

  it('GET /reports/orders groups by currency and reflects a real new order (a unique currency guarantees no collision with other data)', async () => {
    const analyticsViewerCookie = await staffCookieFor('Analytics Viewer');
    // No length truncation here — slicing a timestamp down to a fixed length
    // discards exactly the low-order digits that make it unique, so two runs
    // close together in time would collide on the same "unique" currency.
    const uniqueCurrency = `T${Date.now()}${Math.floor(Math.random() * 10000)}`;

    const member = await prisma.member.create({
      data: {
        shopifyCustomerId: `reports-e2e-orders-${Date.now()}`,
        email: `reports-e2e-orders-${Date.now()}@example.com`,
        membershipTier: 'ANNUAL',
      },
    });
    await prisma.memberOrderCache.create({
      data: {
        memberId: member.id,
        shopifyOrderId: `reports-e2e-order-${Date.now()}`,
        orderNumber: '#TEST1',
        totalAmount: '123.45',
        currency: uniqueCurrency,
        status: 'paid',
        orderDate: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/reports/orders')
      .set('Cookie', analyticsViewerCookie)
      .expect(200);
    const row = res.body.find(
      (r: { currency: string }) => r.currency === uniqueCurrency,
    );
    expect(row).toBeDefined();
    expect(row.orderCount).toBe(1);
    expect(row.totalAmount).toBe('123.45');
  });
});
