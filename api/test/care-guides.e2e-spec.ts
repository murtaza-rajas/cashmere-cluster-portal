import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

// Care & Repair guides (Milestone 5): staff update-only at
// /care-guide-catalog/:topic (Content Manager — see
// care-guides.controller.ts's comment), and the member-facing read at
// /members/me/care-guides. Topics are fixed and pre-seeded (prisma/seed.ts),
// so there's no create/delete to test — only update and the read side.
describe('Care guide catalog (e2e)', () => {
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
        email: `care-guides-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('GET /care-guide-catalog: 401 with no session, 403 for a role without access, 200 with exactly five pre-seeded topics for Content Manager', async () => {
    await request(app.getHttpServer()).get('/care-guide-catalog').expect(401);

    await request(app.getHttpServer())
      .get('/care-guide-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .expect(403);

    const contentManagerCookie = await staffCookieFor('Content Manager');
    const res = await request(app.getHttpServer())
      .get('/care-guide-catalog')
      .set('Cookie', contentManagerCookie)
      .expect(200);

    expect(res.body).toHaveLength(5);
    const topics = res.body.map((r: { topic: string }) => r.topic).sort();
    expect(topics).toEqual([
      'LONGEVITY',
      'PILLING',
      'REPAIRS',
      'STORAGE',
      'WASHING',
    ]);
  });

  it('PATCH /care-guide-catalog/:topic sets the body and writes an audit entry; empty string clears it back to null', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');

    const updated = await request(app.getHttpServer())
      .patch('/care-guide-catalog/WASHING')
      .set('Cookie', contentManagerCookie)
      .send({ body: 'Hand wash cold, lay flat to dry.' })
      .expect(200);
    expect(updated.body.body).toBe('Hand wash cold, lay flat to dry.');

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'care_guide.updated', targetId: updated.body.id },
    });
    expect(auditEntries.length).toBeGreaterThanOrEqual(1);

    const cleared = await request(app.getHttpServer())
      .patch('/care-guide-catalog/WASHING')
      .set('Cookie', contentManagerCookie)
      .send({ body: '' })
      .expect(200);
    expect(cleared.body.body).toBeNull();
  });

  it('PATCH /care-guide-catalog/:topic: 400 for an unknown topic', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    await request(app.getHttpServer())
      .patch('/care-guide-catalog/NOT_A_REAL_TOPIC')
      .set('Cookie', contentManagerCookie)
      .send({ body: 'Anything' })
      .expect(400);
  });

  it('GET /members/me/care-guides: 401 with no session, 200 with all five topics (including the real body just set above) for a real member', async () => {
    await request(app.getHttpServer())
      .get('/members/me/care-guides')
      .expect(401);

    const contentManagerCookie = await staffCookieFor('Content Manager');
    await request(app.getHttpServer())
      .patch('/care-guide-catalog/STORAGE')
      .set('Cookie', contentManagerCookie)
      .send({ body: 'Store folded, away from direct light.' })
      .expect(200);

    const externalId = `care-guides-e2e-member-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/care-guides')
      .set('Cookie', sessionCookieFor(member.id))
      .expect(200);

    expect(res.body).toHaveLength(5);
    const storage = res.body.find(
      (r: { topic: string }) => r.topic === 'STORAGE',
    );
    expect(storage.body).toBe('Store folded, away from direct light.');
    // Member-facing rows are the narrow {topic, body} shape only.
    expect(storage.id).toBeUndefined();
  });
});
