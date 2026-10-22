import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { ShopifyAdminApiService } from '../src/shopify-admin/shopify-admin-api.service';
import { createTestApp } from './test-app.util';

// Staff adding pilot customers by hand: POST /members. Shopify customer
// creation is mocked; everything else runs for real.
describe('Grant membership by hand (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let shopifySpy: jest.SpyInstance;
  const shopifyCalls: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    shopifySpy = jest
      .spyOn(app.get(ShopifyAdminApiService), 'findOrCreateCustomer')
      .mockImplementation(async (person) => {
        shopifyCalls.push(person.email);
        return {
          customerId: `grant-e2e-${Date.now()}-${Math.random()}`,
          created: true,
        };
      });
  });

  afterAll(async () => {
    shopifySpy.mockRestore();
    await app.close();
  });

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `grant-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  const grant = (cookie: string, body: object) =>
    request(app.getHttpServer())
      .post('/members')
      .set('Cookie', cookie)
      .send(body);

  const newEmail = (tag: string) =>
    `grant-e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  it('only a Club Manager can grant; Member Support gets 403, no session 401', async () => {
    await request(app.getHttpServer())
      .post('/members')
      .send({ email: newEmail('x'), tier: 'ANNUAL', months: 12 })
      .expect(401);
    await grant(await staffCookieFor('Member Support'), {
      email: newEmail('x'),
      tier: 'ANNUAL',
      months: 12,
    }).expect(403);
  });

  it('creates a new member (and Shopify customer) with 12 months of the chosen level', async () => {
    const email = newEmail('new');
    const res = await grant(await staffCookieFor('Club Manager'), {
      email: email.toUpperCase(),
      firstName: 'Pilot',
      lastName: 'Tester',
      tier: 'ANNUAL',
      months: 12,
    }).expect(201);

    expect(res.body.created).toBe(true);
    expect(shopifyCalls).toContain(email.toUpperCase());
    const m = await prisma.member.findUniqueOrThrow({
      where: { id: res.body.member.id },
    });
    expect(m.membershipTier).toBe('ANNUAL');
    expect(m.membershipStatus).toBe('ACTIVE');
    expect(m.termLengthMonths).toBe(12);
    expect(m.firstName).toBe('Pilot');
    expect(m.isFoundingMember).toBe(false);
    const months =
      (m.membershipEndDate!.getFullYear() -
        m.membershipStartDate!.getFullYear()) *
        12 +
      (m.membershipEndDate!.getMonth() - m.membershipStartDate!.getMonth());
    expect(months).toBe(12);
    expect(
      Math.abs(m.membershipStartDate!.getTime() - Date.now()),
    ).toBeLessThan(60_000);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'member.membership_granted', targetMemberId: m.id },
    });
    expect(audit?.actorStaffUserId).toBeTruthy();
    expect(audit?.metadata).toMatchObject({
      tier: 'ANNUAL',
      months: 12,
      previousTier: 'NEWSLETTER',
      memberCreated: true,
    });
  });

  it('updates an existing member found by email, without touching Shopify', async () => {
    const email = newEmail('existing');
    const existing = await prisma.member.create({
      data: {
        shopifyCustomerId: `grant-e2e-existing-${Date.now()}`,
        email,
        membershipTier: 'NEWSLETTER',
      },
    });
    const callsBefore = shopifyCalls.length;

    const res = await grant(await staffCookieFor('Club Manager'), {
      email: email.toUpperCase(),
      tier: 'SIX_MONTH',
      months: 12,
    }).expect(201);

    expect(res.body.created).toBe(false);
    expect(res.body.member.id).toBe(existing.id);
    expect(shopifyCalls.length).toBe(callsBefore);
    const m = await prisma.member.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(m.membershipTier).toBe('SIX_MONTH');
    expect(m.termLengthMonths).toBe(12);
  });

  it('Founding sets the permanent Founding flag', async () => {
    const res = await grant(await staffCookieFor('Club Manager'), {
      email: newEmail('founding'),
      tier: 'FOUNDING',
      months: 12,
    }).expect(201);
    expect(res.body.member.isFoundingMember).toBe(true);
  });

  it('Mongolia moves the member to the Mongolia site; other levels to the international site', async () => {
    const cm = await staffCookieFor('Club Manager');
    const email = newEmail('mongolia');
    const res = await grant(cm, { email, tier: 'MONGOLIA', months: 12 }).expect(
      201,
    );
    expect(res.body.member.membershipTier).toBe('MONGOLIA');
    expect(res.body.member.region).toBe('MONGOLIA');
    expect(res.body.member.termLengthMonths).toBe(12);

    const back = await grant(cm, { email, tier: 'ANNUAL', months: 12 }).expect(
      201,
    );
    expect(back.body.member.region).toBe('INTERNATIONAL');
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'member.membership_granted',
        targetMemberId: back.body.member.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.metadata).toMatchObject({ previousRegion: 'MONGOLIA' });
  });

  it('ignores demo/preview accounts with the same email and validates input', async () => {
    const email = newEmail('demo');
    await prisma.member.create({
      data: {
        shopifyCustomerId: `demo-${email}`,
        email,
        membershipTier: 'FOUNDING',
      },
    });
    const cm = await staffCookieFor('Club Manager');
    const res = await grant(cm, { email, tier: 'ANNUAL', months: 12 }).expect(
      201,
    );
    expect(res.body.created).toBe(true);
    expect(res.body.member.shopifyCustomerId).not.toMatch(/^demo-/);

    await grant(cm, {
      email: 'not-an-email',
      tier: 'ANNUAL',
      months: 12,
    }).expect(400);
    await grant(cm, {
      email: newEmail('v'),
      tier: 'NEWSLETTER',
      months: 12,
    }).expect(400);
    await grant(cm, { email: newEmail('v'), tier: 'ANNUAL', months: 0 }).expect(
      400,
    );
    await grant(cm, {
      email: newEmail('v'),
      tier: 'ANNUAL',
      months: 61,
    }).expect(400);
  });
});
