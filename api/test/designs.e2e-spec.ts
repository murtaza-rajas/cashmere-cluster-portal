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

// Founders' Design Lab (Milestone 5 scope addition, client email
// 2026-09-07/08): staff CRUD + 3-slot image upload at /design-catalog
// (Content Manager — see designs.controller.ts's comment), and the
// member-facing read/favorite/vote at /members/me/designs, tier-gated per
// the three real client mockups (Founding: full, Annual: preview/no vote,
// Newsletter & Mongolia: none) — see schema.prisma's comment on the
// Design model for the exact reasoning.
describe('Design catalog (e2e)', () => {
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
        email: `designs-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
        name: `Test ${roleName}`,
      },
    });
    await prisma.staffRoleAssignment.create({ data: { staffUserId: staff.id, roleId: role.id } });
    const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, { expiresIn: '1h' });
    return `clc_staff_session=${token}`;
  }

  async function memberWithTier(tier: 'FOUNDING' | 'ANNUAL' | 'NEWSLETTER' | 'MONGOLIA') {
    const externalId = `designs-e2e-member-${tier}-${Date.now()}-${Math.random()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({ where: { id: member.id }, data: { membershipTier: tier } });
    return member;
  }

  it('POST /design-catalog: 401 with no session, 403 for a role without access, 201 + audit trail for Content Manager', async () => {
    await request(app.getHttpServer())
      .post('/design-catalog')
      .send({ title: 'Spring Long Cardigan' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/design-catalog')
      .set('Cookie', await staffCookieFor('Event Manager'))
      .send({ title: 'Spring Long Cardigan' })
      .expect(403);

    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/design-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Spring Long Cardigan',
        description: 'A timeless silhouette for modern living.',
        round: 'Spring 2027',
        tags: ['Lightweight', 'Everyday', 'Versatile'],
      })
      .expect(201);

    expect(created.body.status).toBe('CURRENT');
    expect(created.body.active).toBe(true);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'design.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH /design-catalog/:id updates status/tags; DELETE removes it and its images', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/design-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Open Mesh Long Cardigan' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/design-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({ status: 'SELECTED_FOR_PRODUCTION', tags: ['Breathable', 'Modern'] })
      .expect(200);
    expect(updated.body.status).toBe('SELECTED_FOR_PRODUCTION');
    expect(updated.body.tags).toEqual(['Breathable', 'Modern']);

    await request(app.getHttpServer())
      .delete(`/design-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/design-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({ title: 'should 404' })
      .expect(404);
  });

  it('uploads and replaces all 3 image slots (hero/swatch/sketch), and rejects an SVG upload with 400', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/design-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Kimono Belted Cardigan' })
      .expect(201);
    const id = created.body.id;

    for (const slot of ['hero', 'swatch', 'sketch']) {
      const uploaded = await request(app.getHttpServer())
        .post(`/design-catalog/${id}/image/${slot}`)
        .set('Cookie', contentManagerCookie)
        .attach('file', FIXTURE_IMAGE)
        .expect(201);
      const urlField = `${slot}ImageUrl`;
      expect(uploaded.body[urlField]).toMatch(new RegExp(`^/uploads/designs/.+\\.jpg$`));
      const savedPath = join(process.cwd(), uploaded.body[urlField].slice(1));
      await expect(fs.stat(savedPath)).resolves.toBeDefined();

      // Replacing deletes the old file.
      const replaced = await request(app.getHttpServer())
        .post(`/design-catalog/${id}/image/${slot}`)
        .set('Cookie', contentManagerCookie)
        .attach('file', FIXTURE_IMAGE)
        .expect(201);
      expect(replaced.body[urlField]).not.toBe(uploaded.body[urlField]);
      await expect(fs.stat(savedPath)).rejects.toThrow();
    }

    await request(app.getHttpServer())
      .post(`/design-catalog/${id}/image/hero`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/design-catalog/${id}/image/not-a-real-slot`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(400);
  });

  it('GET /members/me/designs: Founding sees full access (view/save/vote), Annual sees preview (view/save, no vote), Newsletter and Mongolia see nothing', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const design = await request(app.getHttpServer())
      .post('/design-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Draped Collar Cardigan' })
      .expect(201);
    const designId = design.body.id;

    const founding = await memberWithTier('FOUNDING');
    const annual = await memberWithTier('ANNUAL');
    const newsletter = await memberWithTier('NEWSLETTER');
    const mongolia = await memberWithTier('MONGOLIA');

    const foundingRes = await request(app.getHttpServer())
      .get('/members/me/designs')
      .set('Cookie', sessionCookieFor(founding.id))
      .expect(200);
    const foundingRow = foundingRes.body.find((d: { id: string }) => d.id === designId);
    expect(foundingRow).toBeDefined();
    expect(foundingRow.canVote).toBe(true);

    const annualRes = await request(app.getHttpServer())
      .get('/members/me/designs')
      .set('Cookie', sessionCookieFor(annual.id))
      .expect(200);
    const annualRow = annualRes.body.find((d: { id: string }) => d.id === designId);
    expect(annualRow).toBeDefined();
    expect(annualRow.canVote).toBe(false);

    const newsletterRes = await request(app.getHttpServer())
      .get('/members/me/designs')
      .set('Cookie', sessionCookieFor(newsletter.id))
      .expect(200);
    expect(newsletterRes.body).toEqual([]);

    const mongoliaRes = await request(app.getHttpServer())
      .get('/members/me/designs')
      .set('Cookie', sessionCookieFor(mongolia.id))
      .expect(200);
    expect(mongoliaRes.body).toEqual([]);
  });

  it('favorite/unfavorite works for Founding and Annual, but voting is Founding-only even via a direct request', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const design = await request(app.getHttpServer())
      .post('/design-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Sleeveless Long Vest' })
      .expect(201);
    const designId = design.body.id;

    const founding = await memberWithTier('FOUNDING');
    const annual = await memberWithTier('ANNUAL');
    const newsletter = await memberWithTier('NEWSLETTER');

    // Annual can favorite (real database row, not just a 200).
    await request(app.getHttpServer())
      .post(`/members/me/designs/${designId}/favorite`)
      .set('Cookie', sessionCookieFor(annual.id))
      .expect(201);
    const annualFavorite = await prisma.designFavorite.findUnique({
      where: { designId_memberId: { designId, memberId: annual.id } },
    });
    expect(annualFavorite).toBeDefined();

    // Annual cannot vote — server-side blocked, not just hidden in the UI.
    await request(app.getHttpServer())
      .post(`/members/me/designs/${designId}/vote`)
      .set('Cookie', sessionCookieFor(annual.id))
      .expect(403);

    // Newsletter can't even favorite.
    await request(app.getHttpServer())
      .post(`/members/me/designs/${designId}/favorite`)
      .set('Cookie', sessionCookieFor(newsletter.id))
      .expect(403);

    // Founding can vote, and unvoting actually removes the row.
    await request(app.getHttpServer())
      .post(`/members/me/designs/${designId}/vote`)
      .set('Cookie', sessionCookieFor(founding.id))
      .expect(201);
    let foundingVote = await prisma.designVote.findUnique({
      where: { designId_memberId: { designId, memberId: founding.id } },
    });
    expect(foundingVote).toBeDefined();

    await request(app.getHttpServer())
      .delete(`/members/me/designs/${designId}/vote`)
      .set('Cookie', sessionCookieFor(founding.id))
      .expect(200);
    foundingVote = await prisma.designVote.findUnique({
      where: { designId_memberId: { designId, memberId: founding.id } },
    });
    expect(foundingVote).toBeNull();

    // Real vote/favorite counts reflect on the member-facing read.
    const res = await request(app.getHttpServer())
      .get('/members/me/designs')
      .set('Cookie', sessionCookieFor(founding.id))
      .expect(200);
    const row = res.body.find((d: { id: string }) => d.id === designId);
    expect(row.favoriteCount).toBeGreaterThanOrEqual(1);
    expect(row.voteCount).toBe(0);
  });
});
