import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

// Offers & Benefits (Milestone 5): staff CRUD at /benefit-catalog (Club Manager
// only — see benefits.controller.ts's comment on why it isn't /benefits), and
// the member-facing reads at /members/me/benefits, /members/me/offers, scoped
// to the member's own tier and active rows only.
describe('Benefit catalog (e2e)', () => {
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

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `benefits-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('POST /benefit-catalog: 401 with no session, 403 for a role without access, 201 with the audit trail for Club Manager', async () => {
    await request(app.getHttpServer())
      .post('/benefit-catalog')
      .send({ type: 'OFFER', tiers: ['FOUNDING'], title: 'Test offer' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/benefit-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .send({ type: 'OFFER', tiers: ['FOUNDING'], title: 'Test offer' })
      .expect(403);

    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/benefit-catalog')
      .set('Cookie', clubManagerCookie)
      .send({
        type: 'OFFER',
        tiers: ['FOUNDING', 'ANNUAL'],
        title: 'Autumn scarf sale',
        description: '15% off',
      })
      .expect(201);

    expect(created.body.title).toBe('Autumn scarf sale');
    expect(created.body.tiers).toEqual(['FOUNDING', 'ANNUAL']);
    expect(created.body.active).toBe(true);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'benefit.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH /benefit-catalog/:id updates the row and writes an audit entry; DELETE removes it', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/benefit-catalog')
      .set('Cookie', clubManagerCookie)
      .send({
        type: 'BENEFIT',
        tiers: ['ANNUAL'],
        title: 'Draft row',
        active: false,
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/benefit-catalog/${created.body.id}`)
      .set('Cookie', clubManagerCookie)
      .send({ active: true, description: 'Now live' })
      .expect(200);
    expect(updated.body.active).toBe(true);
    expect(updated.body.description).toBe('Now live');

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'benefit.updated', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/benefit-catalog/${created.body.id}`)
      .set('Cookie', clubManagerCookie)
      .expect(200);

    const stillExists = await prisma.benefit.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
  });

  it('PATCH /benefit-catalog/:id: 404 for an unknown id', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    await request(app.getHttpServer())
      .patch('/benefit-catalog/does-not-exist')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Anything' })
      .expect(404);
  });

  it("GET /members/me/benefits and /members/me/offers only return active rows visible to the member's own tier", async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');

    const foundingOnlyBenefit = await request(app.getHttpServer())
      .post('/benefit-catalog')
      .set('Cookie', clubManagerCookie)
      .send({
        type: 'BENEFIT',
        tiers: ['FOUNDING'],
        title: 'Founding-only perk',
      })
      .expect(201);
    const annualOffer = await request(app.getHttpServer())
      .post('/benefit-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ type: 'OFFER', tiers: ['ANNUAL'], title: 'Annual-only offer' })
      .expect(201);
    const inactiveFoundingBenefit = await request(app.getHttpServer())
      .post('/benefit-catalog')
      .set('Cookie', clubManagerCookie)
      .send({
        type: 'BENEFIT',
        tiers: ['FOUNDING'],
        title: 'Inactive perk',
        active: false,
      })
      .expect(201);

    const externalId = `benefits-e2e-member-${Date.now()}`;
    const foundingMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: foundingMember.id },
      data: { membershipTier: 'FOUNDING' },
    });

    const benefitsRes = await request(app.getHttpServer())
      .get('/members/me/benefits')
      .set('Cookie', sessionCookieFor(foundingMember.id))
      .expect(200);
    const benefitIds = benefitsRes.body.map((b: { id: string }) => b.id);
    expect(benefitIds).toContain(foundingOnlyBenefit.body.id);
    expect(benefitIds).not.toContain(inactiveFoundingBenefit.body.id);

    const offersRes = await request(app.getHttpServer())
      .get('/members/me/offers')
      .set('Cookie', sessionCookieFor(foundingMember.id))
      .expect(200);
    expect(offersRes.body.map((o: { id: string }) => o.id)).not.toContain(
      annualOffer.body.id,
    );
  });
});
