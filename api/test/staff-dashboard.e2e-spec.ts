import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// Staff Dashboard landing page (client's "1.1 ADMIN.png" sketch): real
// aggregate data across Members/MemberOrderCache/DataSubjectRequest at
// /staff-dashboard/* — no @Roles() gate, any authenticated staff member can
// view it (matches the /staff home page's existing un-gated posture).
// Before/after deltas throughout, not exact-value assumptions, since other
// spec files insert Member/Order rows in parallel Jest workers against the
// same dev DB — same discipline as reports.e2e-spec.ts.
describe('Staff Dashboard (e2e)', () => {
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
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const staff = await prisma.staffUser.create({
      data: {
        email: `staff-dashboard-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
        name: `Test ${roleName}`,
      },
    });
    await prisma.staffRoleAssignment.create({ data: { staffUserId: staff.id, roleId: role.id } });
    const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, { expiresIn: '1h' });
    return `clc_staff_session=${token}`;
  }

  it('GET /staff-dashboard/stats: 401 with no session, 200 for ANY authenticated role (no @Roles gate) and reflects a real new member', async () => {
    await request(app.getHttpServer()).get('/staff-dashboard/stats').expect(401);

    // Analytics Viewer is deliberately not the role under test for the other
    // dashboard endpoints — proving even a narrowly-scoped role like Content
    // Manager can see the overview confirms there really is no role gate.
    const cookie = await staffCookieFor('Content Manager');
    const before = await request(app.getHttpServer())
      .get('/staff-dashboard/stats')
      .set('Cookie', cookie)
      .expect(200);
    const totalBefore = before.body.total.count;

    await prisma.member.create({
      data: {
        shopifyCustomerId: `staff-dashboard-e2e-stats-${Date.now()}`,
        email: `staff-dashboard-e2e-stats-${Date.now()}@example.com`,
        membershipTier: 'NEWSLETTER',
      },
    });

    const after = await request(app.getHttpServer())
      .get('/staff-dashboard/stats')
      .set('Cookie', cookie)
      .expect(200);
    expect(after.body.total.count).toBeGreaterThanOrEqual(totalBefore + 1);
    expect(Object.keys(after.body.byTier)).toEqual(
      expect.arrayContaining(['FOUNDING', 'ANNUAL', 'NEWSLETTER', 'MONGOLIA']),
    );
  });

  it('GET /staff-dashboard/growth returns exactly N cumulative, non-decreasing monthly totals oldest-first', async () => {
    const cookie = await staffCookieFor('Event Manager');
    // Bracket the request with two direct counts from the same source rather
    // than comparing against a *second* HTTP call (staff-dashboard/stats) —
    // two independent point-in-time snapshots taken via separate round-trips
    // can legitimately disagree by exactly however many rows another spec
    // file's parallel Jest worker inserted in between (a real flake seen
    // here, same class as reports.e2e-spec.ts's). Bracketing against
    // prisma.member.count() taken immediately before/after tolerates that
    // without weakening what's actually being proven.
    const countBefore = await prisma.member.count();
    const res = await request(app.getHttpServer())
      .get('/staff-dashboard/growth?months=6')
      .set('Cookie', cookie)
      .expect(200);
    const countAfter = await prisma.member.count();

    expect(res.body).toHaveLength(6);
    for (let i = 1; i < res.body.length; i++) {
      // Cumulative — never decreases month over month.
      expect(res.body[i].total).toBeGreaterThanOrEqual(res.body[i - 1].total);
    }
    const mostRecentTotal = res.body[res.body.length - 1].total;
    expect(mostRecentTotal).toBeGreaterThanOrEqual(countBefore);
    expect(mostRecentTotal).toBeLessThanOrEqual(countAfter);
  });

  it('GET /staff-dashboard/recent-members reflects a real new member at the top', async () => {
    const cookie = await staffCookieFor('Member Support');
    const email = `staff-dashboard-e2e-recent-${Date.now()}@example.com`;
    await prisma.member.create({
      data: {
        shopifyCustomerId: `staff-dashboard-e2e-recent-${Date.now()}`,
        email,
        firstName: 'Recent',
        lastName: 'Tester',
        membershipTier: 'ANNUAL',
        region: 'INTERNATIONAL',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/staff-dashboard/recent-members?limit=20')
      .set('Cookie', cookie)
      .expect(200);

    // Find rather than assume index 0 — other spec files creating Member
    // rows in parallel Jest workers can legitimately land a newer row ahead
    // of this one; a generous limit plus a unique email is what actually
    // proves this endpoint surfaced our real insert, not its exact rank.
    const row = res.body.find((m: { name: string }) => m.name === 'Recent Tester');
    expect(row).toBeDefined();
    expect(row.tier).toBe('ANNUAL');
    expect(row.region).toBe('INTERNATIONAL');
  });

  it('GET /staff-dashboard/recent-activity merges a real new member and a real new order, newest first', async () => {
    const cookie = await staffCookieFor('Club Manager');
    const member = await prisma.member.create({
      data: {
        shopifyCustomerId: `staff-dashboard-e2e-activity-${Date.now()}`,
        email: `staff-dashboard-e2e-activity-${Date.now()}@example.com`,
        firstName: 'Activity',
        lastName: 'Tester',
        membershipTier: 'FOUNDING',
      },
    });
    await new Promise((r) => setTimeout(r, 5));
    await prisma.memberOrderCache.create({
      data: {
        memberId: member.id,
        shopifyOrderId: `staff-dashboard-e2e-order-${Date.now()}`,
        orderNumber: '#DASH-TEST',
        totalAmount: '99.00',
        currency: 'USD',
        status: 'paid',
        orderDate: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/staff-dashboard/recent-activity?limit=10')
      .set('Cookie', cookie)
      .expect(200);

    const memberEntry = res.body.find((i: { message: string }) =>
      i.message.includes('Activity Tester'),
    );
    const orderEntry = res.body.find((i: { message: string }) =>
      i.message.includes('#DASH-TEST'),
    );
    expect(memberEntry).toBeDefined();
    expect(orderEntry).toBeDefined();
    expect(memberEntry.type).toBe('member_joined');
    expect(orderEntry.type).toBe('order_received');
    // Newest first — the order was created after the member.
    const orderIndex = res.body.indexOf(orderEntry);
    const memberIndex = res.body.indexOf(memberEntry);
    expect(orderIndex).toBeLessThan(memberIndex);
  });

  it('GET /staff-dashboard/pending-tasks reflects a real pending GDPR request', async () => {
    const cookie = await staffCookieFor('Super Administrator');
    const before = await request(app.getHttpServer())
      .get('/staff-dashboard/pending-tasks')
      .set('Cookie', cookie)
      .expect(200);

    const member = await prisma.member.create({
      data: {
        shopifyCustomerId: `staff-dashboard-e2e-gdpr-${Date.now()}`,
        email: `staff-dashboard-e2e-gdpr-${Date.now()}@example.com`,
        membershipTier: 'NEWSLETTER',
      },
    });
    await prisma.dataSubjectRequest.create({
      data: { memberId: member.id, type: 'ACCESS' },
    });

    const after = await request(app.getHttpServer())
      .get('/staff-dashboard/pending-tasks')
      .set('Cookie', cookie)
      .expect(200);
    expect(after.body.gdprRequestsPending).toBeGreaterThanOrEqual(
      before.body.gdprRequestsPending + 1,
    );
  });
});
