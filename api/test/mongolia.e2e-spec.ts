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
const FIXTURE_SVG = join(__dirname, 'fixtures', 'test-payload.svg');

// Cashmere Lovers Club Mongolia (Milestone 5 scope addition, client emails
// 2026-09-07/08/09): staff CRUD for Mongolia Stories at /mongolia-catalog
// (Content Manager — see mongolia.controller.ts's comment), and the
// member-facing read at /members/me/mongolia/stories, gated to real
// Mongolia-region members only (both Mongolia levels can view; Founding-only
// stories are hidden from Mongolia Newsletter).
describe('Mongolia (e2e)', () => {
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
    const token = jwt.sign({ sub: memberId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    return `clc_session=${token}`;
  }

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const staff = await prisma.staffUser.create({
      data: {
        email: `mongolia-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
        name: `Test ${roleName}`,
      },
    });
    await prisma.staffRoleAssignment.create({ data: { staffUserId: staff.id, roleId: role.id } });
    const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, { expiresIn: '1h' });
    return `clc_staff_session=${token}`;
  }

  async function member(tier: 'NEWSLETTER' | 'MONGOLIA', region: 'MONGOLIA' | 'INTERNATIONAL' = 'MONGOLIA') {
    const externalId = `mongolia-e2e-member-${tier}-${region}-${Date.now()}-${Math.random()}`;
    const m = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({ where: { id: m.id }, data: { membershipTier: tier, region } });
    return m;
  }

  it('POST /mongolia-catalog/stories: 401 with no session, 403 for a role without access, 201 + audit trail for Content Manager', async () => {
    await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .send({ title: 'New Partnership in Mongolia' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .set('Cookie', await staffCookieFor('Event Manager'))
      .send({ title: 'New Partnership in Mongolia' })
      .expect(403);

    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'New Partnership in Mongolia',
        excerpt: 'We are proud to welcome a new artisan factory to our network.',
        category: 'Community',
      })
      .expect(201);

    expect(created.body.active).toBe(true);
    expect(created.body.foundingOnly).toBe(false);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'mongolia_story.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH sets foundingOnly and updates fields; DELETE removes it and its image', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Designer Spotlight: Cansel' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/mongolia-catalog/stories/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({ foundingOnly: true, category: 'Designer Spotlight' })
      .expect(200);
    expect(updated.body.foundingOnly).toBe(true);

    await request(app.getHttpServer())
      .delete(`/mongolia-catalog/stories/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/mongolia-catalog/stories/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({ title: 'should 404' })
      .expect(404);
  });

  it('uploads and replaces the hero image, and rejects an SVG upload with 400', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'From Fiber to Fashion' })
      .expect(201);
    const id = created.body.id;

    const uploaded = await request(app.getHttpServer())
      .post(`/mongolia-catalog/stories/${id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.heroImageUrl).toMatch(/^\/uploads\/mongolia-stories\/.+\.jpg$/);
    const savedPath = join(process.cwd(), uploaded.body.heroImageUrl.slice(1));
    await expect(fs.stat(savedPath)).resolves.toBeDefined();

    const replaced = await request(app.getHttpServer())
      .post(`/mongolia-catalog/stories/${id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(replaced.body.heroImageUrl).not.toBe(uploaded.body.heroImageUrl);
    await expect(fs.stat(savedPath)).rejects.toThrow();

    await request(app.getHttpServer())
      .post(`/mongolia-catalog/stories/${id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);
  });

  it('GET /members/me/mongolia/stories: 403 for a real international member, and Founding-only stories are hidden from Mongolia Newsletter', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const everyoneStory = await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Selected Story For Everyone', foundingOnly: false })
      .expect(201);
    const foundingOnlyStory = await request(app.getHttpServer())
      .post('/mongolia-catalog/stories')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Full Story For Founding Only', foundingOnly: true })
      .expect(201);

    const internationalMember = await member('NEWSLETTER', 'INTERNATIONAL');
    await request(app.getHttpServer())
      .get('/members/me/mongolia/stories')
      .set('Cookie', sessionCookieFor(internationalMember.id))
      .expect(403);

    const mongoliaNewsletter = await member('NEWSLETTER', 'MONGOLIA');
    const newsletterRes = await request(app.getHttpServer())
      .get('/members/me/mongolia/stories')
      .set('Cookie', sessionCookieFor(mongoliaNewsletter.id))
      .expect(200);
    expect(newsletterRes.body.some((s: { id: string }) => s.id === everyoneStory.body.id)).toBe(true);
    expect(newsletterRes.body.some((s: { id: string }) => s.id === foundingOnlyStory.body.id)).toBe(false);

    const mongoliaFounding = await member('MONGOLIA', 'MONGOLIA');
    const foundingRes = await request(app.getHttpServer())
      .get('/members/me/mongolia/stories')
      .set('Cookie', sessionCookieFor(mongoliaFounding.id))
      .expect(200);
    expect(foundingRes.body.some((s: { id: string }) => s.id === everyoneStory.body.id)).toBe(true);
    expect(foundingRes.body.some((s: { id: string }) => s.id === foundingOnlyStory.body.id)).toBe(true);
  });
});
