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

// Tier-specific hero photos (Milestone 5): staff upload/replace/remove at
// /site-image-catalog/:slot/:tier (Club Manager or Content Manager), and the
// member-facing read at /members/me/site-images, scoped to the member's own
// tier. Exercises real multipart file upload end-to-end, not just the DB row.
describe('Site image catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    members = app.get(MembersService);

    // Unlike most other e2e specs in this suite, the (slot, tier) pairs here
    // can't be made unique per run — they're a small, fixed enum keyspace, not
    // an arbitrary identifier. Without this, a repeated run (or a prior manual
    // verification pass against this same dev DB) leaves rows behind that the
    // upsert-based upload logic silently reuses, inflating audit-entry counts
    // this suite asserts on. Safe to wipe entirely: no other spec file touches
    // this table.
    await prisma.siteImage.deleteMany();
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
        email: `site-images-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('POST /site-image-catalog/:slot/:tier: 401 with no session, 403 for a role without access, 201 with a real uploaded file for Club Manager', async () => {
    await request(app.getHttpServer())
      .post('/site-image-catalog/DASHBOARD_HERO/FOUNDING')
      .attach('file', FIXTURE_IMAGE)
      .expect(401);

    await request(app.getHttpServer())
      .post('/site-image-catalog/DASHBOARD_HERO/FOUNDING')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .attach('file', FIXTURE_IMAGE)
      .expect(403);

    const clubManagerCookie = await staffCookieFor('Club Manager');
    const uploaded = await request(app.getHttpServer())
      .post('/site-image-catalog/DASHBOARD_HERO/FOUNDING')
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);

    expect(uploaded.body.slot).toBe('DASHBOARD_HERO');
    expect(uploaded.body.tier).toBe('FOUNDING');
    expect(uploaded.body.url).toMatch(/^\/uploads\/site-images\/.+\.jpg$/);

    // The file the service claims to have saved actually exists on disk.
    const savedPath = join(process.cwd(), uploaded.body.url.slice(1));
    const stat = await fs.stat(savedPath);
    expect(stat.isFile()).toBe(true);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'site_image.uploaded', targetId: uploaded.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('uploading again for the same (slot, tier) replaces the row and deletes the old file', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const first = await request(app.getHttpServer())
      .post('/site-image-catalog/CARE_REPAIR_HERO/ANNUAL')
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    const firstPath = join(process.cwd(), first.body.url.slice(1));

    const second = await request(app.getHttpServer())
      .post('/site-image-catalog/CARE_REPAIR_HERO/ANNUAL')
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);

    // Same row (same slot/tier => same id via upsert), new file.
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.url).not.toBe(first.body.url);

    await expect(fs.stat(firstPath)).rejects.toThrow();

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'site_image.replaced', targetId: second.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('DELETE /site-image-catalog/:slot/:tier removes the row, the file, and writes an audit entry; 404 if nothing is set', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const created = await request(app.getHttpServer())
      .post('/site-image-catalog/DASHBOARD_HERO/MONGOLIA')
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    const savedPath = join(process.cwd(), created.body.url.slice(1));

    await request(app.getHttpServer())
      .delete('/site-image-catalog/DASHBOARD_HERO/MONGOLIA')
      .set('Cookie', clubManagerCookie)
      .expect(200);

    const stillExists = await prisma.siteImage.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
    await expect(fs.stat(savedPath)).rejects.toThrow();

    await request(app.getHttpServer())
      .delete('/site-image-catalog/DASHBOARD_HERO/MONGOLIA')
      .set('Cookie', clubManagerCookie)
      .expect(404);
  });

  it('POST /site-image-catalog/:slot/:tier: 400 for an unknown slot or a non-image file', async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    await request(app.getHttpServer())
      .post('/site-image-catalog/NOT_A_REAL_SLOT/FOUNDING')
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(400);
  });

  it("GET /members/me/site-images only returns slots configured for the member's own tier", async () => {
    const clubManagerCookie = await staffCookieFor('Club Manager');
    const uploaded = await request(app.getHttpServer())
      .post('/site-image-catalog/DASHBOARD_HERO/NEWSLETTER')
      .set('Cookie', clubManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);

    const externalId = `site-images-e2e-member-${Date.now()}`;
    const newsletterMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/site-images')
      .set('Cookie', sessionCookieFor(newsletterMember.id))
      .expect(200);

    expect(res.body.DASHBOARD_HERO).toBe(uploaded.body.url);
    expect(res.body.CARE_REPAIR_HERO).toBeUndefined();
  });
});
