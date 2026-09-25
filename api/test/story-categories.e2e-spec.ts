import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// Stories & Knowledge categories (client email 2026-09-24): a real, growable
// list rather than a fixed enum — Super Administrator can add to it later
// without developer help, every other role can only select from what
// already exists. Read: Content Manager. Create: Super Administrator only.
describe('Story categories (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  // Only deletes the rows this suite itself creates (by exact name), not a
  // blanket wipe — unlike most content tables, the 4 launch categories are
  // real, load-bearing seed data other suites (Stories) depend on existing.
  afterAll(async () => {
    await prisma.storyCategory.deleteMany({
      where: { name: { in: ['Test category', 'Behind the Scenes'] } },
    });
    await app.close();
  });

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `story-categories-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('GET /story-categories: 401 with no session, 200 with the 4 seeded categories for Content Manager', async () => {
    await request(app.getHttpServer()).get('/story-categories').expect(401);

    const res = await request(app.getHttpServer())
      .get('/story-categories')
      .set('Cookie', await staffCookieFor('Content Manager'))
      .expect(200);
    const names = res.body.map((c: { name: string }) => c.name).sort();
    expect(names).toEqual([
      'Designer Spotlight',
      'Knowledge',
      'Mongolia & the World',
      'Story',
    ]);
  });

  it('POST /story-categories: 403 for Content Manager, 201 with audit trail for Super Administrator', async () => {
    await request(app.getHttpServer())
      .post('/story-categories')
      .set('Cookie', await staffCookieFor('Content Manager'))
      .send({ name: 'Test category' })
      .expect(403);

    const superAdminCookie = await staffCookieFor('Super Administrator');
    const created = await request(app.getHttpServer())
      .post('/story-categories')
      .set('Cookie', superAdminCookie)
      .send({ name: 'Test category' })
      .expect(201);
    expect(created.body.name).toBe('Test category');

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'story_category.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/story-categories')
      .set('Cookie', superAdminCookie)
      .expect(200);
    expect(list.body.map((c: { name: string }) => c.name)).toContain(
      'Test category',
    );
  });

  it('POST /story-categories: 409 for a duplicate name', async () => {
    const superAdminCookie = await staffCookieFor('Super Administrator');
    await request(app.getHttpServer())
      .post('/story-categories')
      .set('Cookie', superAdminCookie)
      .send({ name: 'Behind the Scenes' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/story-categories')
      .set('Cookie', superAdminCookie)
      .send({ name: 'Behind the Scenes' })
      .expect(409);
  });
});
