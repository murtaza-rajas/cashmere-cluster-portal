import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// Membership Levels admin (client email 2026-09-15): staff update-only at
// /membership-level-catalog/:tier (Club Manager — see
// membership-levels.controller.ts's comment). Tiers are fixed and
// pre-seeded (prisma/seed.ts, one row per MembershipTier), so there's no
// create/delete to test — only update, same shape as care-guides.e2e-spec.ts.
describe('Membership level catalog (e2e)', () => {
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
        email: `membership-levels-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('GET /membership-level-catalog: 401 with no session, 403 for a role without access, 200 with exactly four pre-seeded levels for Club Manager', async () => {
    await request(app.getHttpServer())
      .get('/membership-level-catalog')
      .expect(401);

    await request(app.getHttpServer())
      .get('/membership-level-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .expect(403);

    const clubManagerCookie = await staffCookieFor('Club Manager');
    const res = await request(app.getHttpServer())
      .get('/membership-level-catalog')
      .set('Cookie', clubManagerCookie)
      .expect(200);

    expect(res.body).toHaveLength(4);
    const tiers = res.body.map((r: { tier: string }) => r.tier).sort();
    expect(tiers).toEqual(['ANNUAL', 'FOUNDING', 'MONGOLIA', 'NEWSLETTER']);
  });

  it('PATCH /membership-level-catalog/:tier updates fields and writes an audit entry, without touching other tiers', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');

    const before = await prisma.membershipLevel.findUniqueOrThrow({
      where: { tier: 'ANNUAL' },
    });

    // Bracket against a before/after count rather than an absolute length —
    // ANNUAL is one of only 4 fixed, pre-seeded rows (never created fresh
    // per test), so a repeated run accumulates audit entries against the
    // same targetId. Same fix as the 2026-09-15 orders.e2e-spec.ts finding.
    const auditCountBefore = await prisma.auditLog.count({
      where: { action: 'membership_level.updated', targetId: before.id },
    });

    const updated = await request(app.getHttpServer())
      .patch('/membership-level-catalog/ANNUAL')
      .set('Cookie', clubManagerCookie)
      .send({
        price: 4500,
        currency: 'NOK',
        benefits: 'Full member access, standard offers.',
      })
      .expect(200);

    expect(updated.body.price).toBe('4500');
    expect(updated.body.currency).toBe('NOK');
    expect(updated.body.benefits).toBe('Full member access, standard offers.');
    // periodLabel/displayName untouched — PATCH, not a full replace.
    expect(updated.body.periodLabel).toBe(before.periodLabel);
    expect(updated.body.displayName).toBe(before.displayName);

    const auditCountAfter = await prisma.auditLog.count({
      where: { action: 'membership_level.updated', targetId: before.id },
    });
    expect(auditCountAfter).toBe(auditCountBefore + 1);

    const foundingUnchanged = await prisma.membershipLevel.findUniqueOrThrow({
      where: { tier: 'FOUNDING' },
    });
    expect(foundingUnchanged.price).toBeNull();

    // Restore, so this test is safe to re-run and doesn't leave the shared
    // dev DB's real seeded content mutated for the next run/session.
    await prisma.membershipLevel.update({
      where: { tier: 'ANNUAL' },
      data: {
        price: before.price,
        currency: before.currency,
        benefits: before.benefits,
      },
    });
  });

  it('PATCH /membership-level-catalog/:tier: 400 for an invalid tier (not a real enum value)', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    await request(app.getHttpServer())
      .patch('/membership-level-catalog/NOT-A-REAL-TIER')
      .set('Cookie', clubManagerCookie)
      .send({ displayName: 'Anything' })
      .expect(400);
  });
});
