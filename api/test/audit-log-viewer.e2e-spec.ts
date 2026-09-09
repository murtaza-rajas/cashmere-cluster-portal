import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditLogService } from '../src/audit-log/audit-log.service';
import { createTestApp } from './test-app.util';

// GET /audit-log, GET /audit-log/actions — the read side AuditLogService never
// had until now (see PROJECT_TRACKER.md; every other admin feature already
// writes here). Super Administrator only, same as Staff & Roles.
describe('Audit Log viewer (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auditLog: AuditLogService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    auditLog = app.get(AuditLogService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createStaffCookie(
    roleName: string,
    emailPrefix: string,
  ): Promise<{ staffId: string; cookie: string }> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `${emailPrefix}-${Date.now()}-${Math.random()}@example.com`,
        name: `Test ${roleName}`,
      },
    });
    await prisma.staffRoleAssignment.create({
      data: { staffUserId: staff.id, roleId: role.id },
    });
    const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, {
      expiresIn: '1h',
    });
    return { staffId: staff.id, cookie: `clc_staff_session=${token}` };
  }

  it('GET /audit-log: 401 with no session, 403 for a role without access, 200 with real entries for Super Administrator', async () => {
    await request(app.getHttpServer()).get('/audit-log').expect(401);

    const { cookie: clubManagerCookie } = await createStaffCookie(
      'Club Manager',
      'audit-log-e2e-cm',
    );
    await request(app.getHttpServer())
      .get('/audit-log')
      .set('Cookie', clubManagerCookie)
      .expect(403);

    const { staffId: superAdminId, cookie: superAdminCookie } =
      await createStaffCookie('Super Administrator', 'audit-log-e2e-sa');

    // A real entry to find — reuses the same service every other feature logs through.
    const uniqueAction = `e2e_test.marker_${Date.now()}`;
    await auditLog.log({
      actorStaffUserId: superAdminId,
      action: uniqueAction,
      targetType: 'Test',
      targetId: 'marker-1',
    });

    const res = await request(app.getHttpServer())
      .get(`/audit-log?action=${uniqueAction}`)
      .set('Cookie', superAdminCookie)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].action).toBe(uniqueAction);
    expect(res.body.items[0].actorStaffUser.id).toBe(superAdminId);
  });

  it('GET /audit-log paginates and filters by targetType/date range', async () => {
    const { cookie: superAdminCookie } = await createStaffCookie(
      'Super Administrator',
      'audit-log-e2e-sa2',
    );

    const targetType = `E2ETestTarget_${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await auditLog.log({
        action: `e2e_test.paginated_${i}`,
        targetType,
        targetId: `t-${i}`,
      });
    }

    const page1 = await request(app.getHttpServer())
      .get(`/audit-log?targetType=${targetType}&page=1&pageSize=2`)
      .set('Cookie', superAdminCookie)
      .expect(200);
    expect(page1.body.total).toBe(3);
    expect(page1.body.items).toHaveLength(2);

    const page2 = await request(app.getHttpServer())
      .get(`/audit-log?targetType=${targetType}&page=2&pageSize=2`)
      .set('Cookie', superAdminCookie)
      .expect(200);
    expect(page2.body.items).toHaveLength(1);

    const farFuture = await request(app.getHttpServer())
      .get(`/audit-log?targetType=${targetType}&from=2099-01-01`)
      .set('Cookie', superAdminCookie)
      .expect(200);
    expect(farFuture.body.total).toBe(0);
  });

  it('GET /audit-log/actions: 401 with no session, 200 with a real distinct action list for Super Administrator', async () => {
    await request(app.getHttpServer()).get('/audit-log/actions').expect(401);

    const { cookie: superAdminCookie } = await createStaffCookie(
      'Super Administrator',
      'audit-log-e2e-sa3',
    );

    const uniqueAction = `e2e_test.actions_marker_${Date.now()}`;
    await auditLog.log({
      action: uniqueAction,
      targetType: 'Test',
      targetId: 'marker-2',
    });

    const res = await request(app.getHttpServer())
      .get('/audit-log/actions')
      .set('Cookie', superAdminCookie)
      .expect(200);
    expect(res.body).toContain(uniqueAction);
  });
});
