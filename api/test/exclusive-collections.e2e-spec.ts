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

// Exclusive Collections: re-scoped 2026-10-07 from "sync real Shopify data"
// (blocked on Storefront API credentials since 2026-09-05) to staff-
// authored collection pitches with a real photo — same shape as
// Events/Benefits, no API dependency. Staff CRUD + image upload at
// /exclusive-collection-catalog (Club Manager, same role as Offers &
// Benefits — see exclusive-collections.controller.ts's comment), member-
// facing read at /members/me/exclusive-collections, scoped to the member's
// own tier and active rows only. International-only — no region scoping,
// unlike Events/Benefits.
describe('Exclusive collection catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
  });

  afterAll(async () => {
    const leftover = await prisma.exclusiveCollection.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    await prisma.exclusiveCollection.deleteMany();
    await Promise.all(
      leftover.map((c) =>
        fs
          .unlink(join(process.cwd(), c.imageUrl!.slice(1)))
          .catch(() => undefined),
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
        email: `exclusive-collections-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('POST /exclusive-collection-catalog: 401 with no session, 403 for a role without access, 201 with the audit trail for Club Manager', async () => {
    await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .send({ title: 'Test collection', tiers: ['FOUNDING'] })
      .expect(401);

    await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .send({ title: 'Test collection', tiers: ['FOUNDING'] })
      .expect(403);

    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({
        title: 'Winter Cashmere Capsule',
        description: 'A small-batch collection, members-only pre-order.',
        tiers: ['FOUNDING', 'ANNUAL'],
      })
      .expect(201);

    expect(created.body.title).toBe('Winter Cashmere Capsule');
    expect(created.body.tiers).toEqual(['FOUNDING', 'ANNUAL']);
    expect(created.body.active).toBe(true);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'exclusive_collection.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH /exclusive-collection-catalog/:id updates the row and writes an audit entry; DELETE removes it', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Draft collection', tiers: [], active: false })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/exclusive-collection-catalog/${created.body.id}`)
      .set('Cookie', clubManagerCookie)
      .send({ active: true, description: 'Now with a description.' })
      .expect(200);
    expect(updated.body.active).toBe(true);
    expect(updated.body.description).toBe('Now with a description.');

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'exclusive_collection.updated', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/exclusive-collection-catalog/${created.body.id}`)
      .set('Cookie', clubManagerCookie)
      .expect(200);

    const stillExists = await prisma.exclusiveCollection.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
  });

  it('PATCH /exclusive-collection-catalog/:id: 404 for an unknown id', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    await request(app.getHttpServer())
      .patch('/exclusive-collection-catalog/does-not-exist')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Anything' })
      .expect(404);
  });

  it('POST /exclusive-collection-catalog/:id/image uploads a real file; uploading again replaces it; DELETE removes it', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Collection with photo', tiers: ['FOUNDING'] })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post(`/exclusive-collection-catalog/${created.body.id}/image`)
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.imageUrl).toMatch(/^\/uploads\/exclusive-collections\/.+\.jpg$/);
    const firstPath = join(process.cwd(), uploaded.body.imageUrl.slice(1));
    await expect(fs.stat(firstPath)).resolves.toBeDefined();

    const replaced = await request(app.getHttpServer())
      .post(`/exclusive-collection-catalog/${created.body.id}/image`)
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(replaced.body.imageUrl).not.toBe(uploaded.body.imageUrl);
    await expect(fs.stat(firstPath)).rejects.toThrow();

    const auditReplaced = await prisma.auditLog.findMany({
      where: { action: 'exclusive_collection.image_replaced', targetId: created.body.id },
    });
    expect(auditReplaced).toHaveLength(1);

    const secondPath = join(process.cwd(), replaced.body.imageUrl.slice(1));
    await request(app.getHttpServer())
      .delete(`/exclusive-collection-catalog/${created.body.id}/image`)
      .set('Cookie', clubManagerCookie)
      .expect(200);
    await expect(fs.stat(secondPath)).rejects.toThrow();

    const finalRow = await prisma.exclusiveCollection.findUnique({
      where: { id: created.body.id },
    });
    expect(finalRow!.imageUrl).toBeNull();
  });

  // Regression test for the real stored-XSS finding (2026-09-09 security
  // review) — same fileFilter util, same fix, exercised here too since this
  // is a separate upload endpoint.
  it('POST /exclusive-collection-catalog/:id/image rejects an SVG upload (stored-XSS vector) with 400', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ title: `SVG Upload Test ${Date.now()}`, tiers: ['FOUNDING'] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/exclusive-collection-catalog/${created.body.id}/image`)
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);
  });

  it("GET /members/me/exclusive-collections only returns active collections visible to the member's own tier", async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');

    const foundingOnly = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Founding-only collection', tiers: ['FOUNDING'] })
      .expect(201);
    const annualOnly = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Annual-only collection', tiers: ['ANNUAL'] })
      .expect(201);
    const inactiveFounding = await request(app.getHttpServer())
      .post('/exclusive-collection-catalog')
      .set('Cookie', clubManagerCookie)
      .send({ title: 'Inactive collection', tiers: ['FOUNDING'], active: false })
      .expect(201);

    const externalId = `exclusive-collections-e2e-member-${Date.now()}`;
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
      .get('/members/me/exclusive-collections')
      .set('Cookie', sessionCookieFor(foundingMember.id))
      .expect(200);
    const ids = res.body.map((c: { id: string }) => c.id);
    expect(ids).toContain(foundingOnly.body.id);
    expect(ids).not.toContain(annualOnly.body.id);
    expect(ids).not.toContain(inactiveFounding.body.id);
  });
});
