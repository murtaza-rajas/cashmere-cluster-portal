import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// GET/POST /staff — the first Milestone 5 backend piece: Super Administrators
// creating staff accounts (PDF page 3), previously only possible via a dev
// script, not a real endpoint. Exercises the real HTTP layer (auth guard + role
// guard + controller + service together), not just StaffService in isolation.
describe('GET/POST /staff (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createStaffWithRole(roleName: string, email: string) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const staff = await prisma.staffUser.create({ data: { email, name: `Test ${roleName}` } });
    await prisma.staffRoleAssignment.create({
      data: { staffUserId: staff.id, roleId: role.id },
    });
    return staff;
  }

  function staffCookieFor(staffUserId: string): string {
    const token = jwt.sign({ sub: staffUserId }, process.env.STAFF_JWT_SECRET!, { expiresIn: '1h' });
    return `clc_staff_session=${token}`;
  }

  it('401s with no session, both routes', async () => {
    await request(app.getHttpServer()).get('/staff').expect(401);
    await request(app.getHttpServer()).post('/staff').send({ email: 'x@example.com', name: 'X' }).expect(401);
  });

  it('403s for a non-Super-Administrator role, both routes', async () => {
    const staff = await createStaffWithRole('Analytics Viewer', `staff-e2e-nonadmin-${Date.now()}@example.com`);
    const cookie = staffCookieFor(staff.id);

    await request(app.getHttpServer()).get('/staff').set('Cookie', cookie).expect(403);
    await request(app.getHttpServer())
      .post('/staff')
      .set('Cookie', cookie)
      .send({ email: 'new@example.com', name: 'New' })
      .expect(403);
  });

  it('Super Administrator can create a staff account, and it appears in the list with no roles yet', async () => {
    const admin = await createStaffWithRole('Super Administrator', `staff-e2e-admin-${Date.now()}@example.com`);
    const cookie = staffCookieFor(admin.id);
    const newEmail = `staff-e2e-created-${Date.now()}@example.com`;

    const created = await request(app.getHttpServer())
      .post('/staff')
      .set('Cookie', cookie)
      .send({ email: newEmail, name: 'Newly Created' })
      .expect(201);

    expect(created.body.email).toBe(newEmail);

    const list = await request(app.getHttpServer()).get('/staff').set('Cookie', cookie).expect(200);
    const found = list.body.find((s: { id: string }) => s.id === created.body.id);
    expect(found).toBeDefined();
    expect(found.roles).toEqual([]);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'staff.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].actorStaffUserId).toBe(admin.id);
  });

  it('rejects creating a staff account with an email that already exists', async () => {
    const admin = await createStaffWithRole('Super Administrator', `staff-e2e-admin2-${Date.now()}@example.com`);
    const cookie = staffCookieFor(admin.id);
    const dupeEmail = `staff-e2e-dupe-${Date.now()}@example.com`;

    await request(app.getHttpServer()).post('/staff').set('Cookie', cookie).send({ email: dupeEmail, name: 'First' }).expect(201);
    await request(app.getHttpServer()).post('/staff').set('Cookie', cookie).send({ email: dupeEmail, name: 'Second' }).expect(409);
  });

  it('rejects an invalid email with a 400, not a 500', async () => {
    const admin = await createStaffWithRole('Super Administrator', `staff-e2e-admin3-${Date.now()}@example.com`);
    await request(app.getHttpServer())
      .post('/staff')
      .set('Cookie', staffCookieFor(admin.id))
      .send({ email: 'not-an-email', name: 'Bad Email' })
      .expect(400);
  });

  // GET /staff/me — real bug caught building the admin UI: this used to return
  // a bare StaffUser with no `roles` field at all (StaffService.findById didn't
  // include role assignments), which crashed the frontend's role-gating logic
  // the moment it read `staff.roles.includes(...)`. Locking in the fix.
  it('GET /staff/me includes the caller\'s own role names', async () => {
    const staff = await createStaffWithRole('Event Manager', `staff-e2e-me-${Date.now()}@example.com`);
    const res = await request(app.getHttpServer())
      .get('/staff/me')
      .set('Cookie', staffCookieFor(staff.id))
      .expect(200);

    expect(res.body.id).toBe(staff.id);
    expect(res.body.roles).toEqual(['Event Manager']);
  });

  // GET /staff/roles — feeds the admin UI's role-grant dropdown with the real
  // seeded roles rather than a hardcoded, driftable copy of the same list.
  it('GET /staff/roles: 401 with no session, 403 for non-Super-Administrator, 200 with all 10 seeded roles for Super Administrator', async () => {
    await request(app.getHttpServer()).get('/staff/roles').expect(401);

    const nonAdmin = await createStaffWithRole('Analytics Viewer', `staff-e2e-roles-nonadmin-${Date.now()}@example.com`);
    await request(app.getHttpServer()).get('/staff/roles').set('Cookie', staffCookieFor(nonAdmin.id)).expect(403);

    const admin = await createStaffWithRole('Super Administrator', `staff-e2e-roles-admin-${Date.now()}@example.com`);
    const res = await request(app.getHttpServer()).get('/staff/roles').set('Cookie', staffCookieFor(admin.id)).expect(200);
    expect(res.body).toHaveLength(10);
    expect(res.body.some((r: { name: string }) => r.name === 'Super Administrator')).toBe(true);
    expect(res.body.some((r: { name: string }) => r.name === 'Member Support')).toBe(true);
  });
});
