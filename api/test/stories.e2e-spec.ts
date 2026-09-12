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

// Stories & Knowledge (Milestone 5, built 2026-09-12): staff CRUD + hero
// image upload at /story-catalog (Content Manager), and the member-facing
// read at /members/me/stories, scoped to the member's own tier and active
// rows only. Replaces the honest "coming soon" placeholder at /news.
// Deliberately no region scoping (unlike Events/Benefits) — this is the
// international storiesKnowledge area; Mongolia has its own separate
// MongoliaStory content type.
describe('Story catalog (e2e)', () => {
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
        email: `stories-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('POST /story-catalog: 401 with no session, 403 for a role without access, 201 with the audit trail for Content Manager', async () => {
    await request(app.getHttpServer())
      .post('/story-catalog')
      .send({ title: 'Test story', tiers: ['FOUNDING'] })
      .expect(401);

    await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .send({ title: 'Test story', tiers: ['FOUNDING'] })
      .expect(403);

    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'From Herd to Hem: a Mongolia sourcing story',
        body: 'The full story body.',
        quote: 'Every scarf carries a herder’s season.',
        category: 'Producer Story',
        tiers: ['FOUNDING', 'ANNUAL'],
      })
      .expect(201);

    expect(created.body.title).toBe(
      'From Herd to Hem: a Mongolia sourcing story',
    );
    expect(created.body.category).toBe('Producer Story');
    expect(created.body.tiers).toEqual(['FOUNDING', 'ANNUAL']);
    expect(created.body.active).toBe(true);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'story.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH /story-catalog/:id updates the row and writes an audit entry; DELETE removes it', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Draft story', tiers: [], active: false })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/story-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({ active: true, tiers: ['NEWSLETTER'] })
      .expect(200);
    expect(updated.body.active).toBe(true);
    expect(updated.body.tiers).toEqual(['NEWSLETTER']);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'story.updated', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/story-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .expect(200);

    const stillExists = await prisma.story.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
  });

  it('PATCH /story-catalog/:id: 404 for an unknown id', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    await request(app.getHttpServer())
      .patch('/story-catalog/does-not-exist')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Anything' })
      .expect(404);
  });

  it('POST /story-catalog/:id/image uploads a real file; uploading again replaces it; DELETE removes it', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Story with photo', tiers: ['FOUNDING'] })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.heroImageUrl).toMatch(/^\/uploads\/stories\/.+\.jpg$/);
    const firstPath = join(process.cwd(), uploaded.body.heroImageUrl.slice(1));
    await expect(fs.stat(firstPath)).resolves.toBeDefined();

    const replaced = await request(app.getHttpServer())
      .post(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(replaced.body.heroImageUrl).not.toBe(uploaded.body.heroImageUrl);
    await expect(fs.stat(firstPath)).rejects.toThrow();

    const auditReplaced = await prisma.auditLog.findMany({
      where: { action: 'story.image_replaced', targetId: created.body.id },
    });
    expect(auditReplaced).toHaveLength(1);

    const secondPath = join(process.cwd(), replaced.body.heroImageUrl.slice(1));
    await request(app.getHttpServer())
      .delete(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .expect(200);
    await expect(fs.stat(secondPath)).rejects.toThrow();

    const finalRow = await prisma.story.findUnique({
      where: { id: created.body.id },
    });
    expect(finalRow!.heroImageUrl).toBeNull();
  });

  // Regression test for the 2026-09-09 stored-XSS finding — same fileFilter
  // util, same fix, exercised here too since this is a separate upload
  // endpoint (see events.e2e-spec.ts/site-images.e2e-spec.ts for the full
  // explanation).
  it('POST /story-catalog/:id/image rejects an SVG upload (stored-XSS vector) with 400', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: `SVG Upload Test ${Date.now()}`, tiers: ['FOUNDING'] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);
  });

  it("GET /members/me/stories only returns active stories visible to the member's own tier", async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');

    const foundingOnlyStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Founding-only story', tiers: ['FOUNDING'] })
      .expect(201);
    const annualOnlyStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Annual-only story', tiers: ['ANNUAL'] })
      .expect(201);
    const inactiveFoundingStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Inactive story',
        tiers: ['FOUNDING'],
        active: false,
      })
      .expect(201);

    const externalId = `stories-e2e-member-${Date.now()}`;
    const foundingMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: foundingMember.id },
      data: { membershipTier: 'FOUNDING' },
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/stories')
      .set('Cookie', sessionCookieFor(foundingMember.id))
      .expect(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(foundingOnlyStory.body.id);
    expect(ids).not.toContain(annualOnlyStory.body.id);
    expect(ids).not.toContain(inactiveFoundingStory.body.id);
  });

  // A "public" story (visible to all four tiers, including Newsletter) is
  // the structured-model equivalent of the client's "public stories only"
  // preview rule for Newsletter/Mongolia (see web/lib/access.ts's
  // storiesKnowledge comment) — reachable by a Newsletter member, unlike a
  // members-only (Founding/Annual-only) story.
  it('a story visible to all tiers reaches a Newsletter member; a Founding-only story does not', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');

    const publicStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Club news, for everyone',
        tiers: ['FOUNDING', 'ANNUAL', 'NEWSLETTER', 'MONGOLIA'],
      })
      .expect(201);
    const membersOnlyStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Members-only story', tiers: ['FOUNDING', 'ANNUAL'] })
      .expect(201);

    const externalId = `stories-e2e-newsletter-${Date.now()}`;
    const newsletterMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/stories')
      .set('Cookie', sessionCookieFor(newsletterMember.id))
      .expect(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(publicStory.body.id);
    expect(ids).not.toContain(membersOnlyStory.body.id);
  });
});
