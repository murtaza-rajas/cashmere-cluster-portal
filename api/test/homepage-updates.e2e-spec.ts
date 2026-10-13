import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { join } from 'path';
import { promises as fs } from 'fs';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

const FIXTURE_IMAGE = join(__dirname, 'fixtures', 'test-image.jpg');

// "CLC Update" homepage banner: staff CRUD + image at /homepage-update-catalog
// (Content Manager); members get the newest active banner for their tier.
describe('Homepage update catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
  });

  afterAll(async () => {
    const leftover = await prisma.homepageUpdate.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    await prisma.homepageUpdate.deleteMany();
    await Promise.all(
      leftover.map((u) =>
        fs.unlink(join(process.cwd(), u.imageUrl!.slice(1))).catch(() => undefined),
      ),
    );
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
        email: `homepage-updates-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  async function memberCookie(tier: 'NEWSLETTER' | 'ANNUAL' | 'FOUNDING') {
    const externalId = `homepage-updates-e2e-${tier}-${Date.now()}-${Math.random()}`;
    const m = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({ where: { id: m.id }, data: { membershipTier: tier } });
    return sessionCookieFor(m.id);
  }

  it('staff endpoints: 401 with no session, 403 for a role without access', async () => {
    await request(app.getHttpServer()).get('/homepage-update-catalog').expect(401);
    await request(app.getHttpServer())
      .get('/homepage-update-catalog')
      .set('Cookie', await staffCookieFor('Event Manager'))
      .expect(403);
  });

  it('Content Manager creates a banner linked to a story, uploads its image, and members of the chosen levels see it', async () => {
    const cm = await staffCookieFor('Content Manager');
    const category = await prisma.storyCategory.findFirstOrThrow();
    const story = await prisma.story.create({
      data: { title: 'CLC Update – Building the Club Together', categoryId: category.id, tiers: ['NEWSLETTER', 'ANNUAL', 'FOUNDING'], status: 'PUBLISHED' },
    });

    const created = await request(app.getHttpServer())
      .post('/homepage-update-catalog')
      .set('Cookie', cm)
      .send({
        title: 'Together, we are building the club',
        summary: 'Follow our progress and see how you can help our community grow.',
        displayDate: '2026-10-11',
        storyId: story.id,
        tiers: ['NEWSLETTER', 'ANNUAL', 'FOUNDING'],
      })
      .expect(201);
    expect(created.body.label).toBe('CLC Update');

    const uploaded = await request(app.getHttpServer())
      .post(`/homepage-update-catalog/${created.body.id}/image`)
      .set('Cookie', cm)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.imageUrl).toMatch(/^\/uploads\/homepage-updates\//);

    for (const tier of ['NEWSLETTER', 'FOUNDING'] as const) {
      const res = await request(app.getHttpServer())
        .get('/members/me/homepage-update')
        .set('Cookie', await memberCookie(tier))
        .expect(200);
      expect(res.body).toMatchObject({
        id: created.body.id,
        title: 'Together, we are building the club',
        storyId: story.id,
        imageUrl: uploaded.body.imageUrl,
      });
    }

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'homepage_update.created', targetId: created.body.id },
    });
    expect(audit).not.toBeNull();
  });

  it('members only get an active banner for their own level; the newest by date wins', async () => {
    const cm = await staffCookieFor('Content Manager');
    const post = (body: object) =>
      request(app.getHttpServer()).post('/homepage-update-catalog').set('Cookie', cm).send(body).expect(201);

    const older = await post({ title: 'Older', summary: 's', displayDate: '2026-09-01', tiers: ['ANNUAL'] });
    const newer = await post({ title: 'Newer', summary: 's', displayDate: '2026-12-01', tiers: ['ANNUAL'] });
    await post({ title: 'Inactive', summary: 's', displayDate: '2027-01-01', tiers: ['ANNUAL'], active: false });

    const annual = await request(app.getHttpServer())
      .get('/members/me/homepage-update')
      .set('Cookie', await memberCookie('ANNUAL'))
      .expect(200);
    expect(annual.body.id).toBe(newer.body.id);
    expect(annual.body.id).not.toBe(older.body.id);

    // Turning the newest off falls back to the next one.
    await request(app.getHttpServer())
      .patch(`/homepage-update-catalog/${newer.body.id}`)
      .set('Cookie', cm)
      .send({ active: false })
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/members/me/homepage-update')
      .set('Cookie', await memberCookie('ANNUAL'))
      .expect(200);
    expect(after.body.title).not.toBe('Newer');
  });
});
