import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { MembersService } from '../src/members/members.service';
import { StaffService } from '../src/staff/staff.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Proves the real AuditLog write-paths actually fire — not the dev scripts (which
// bypass the app via raw Prisma calls), the actual service methods the app calls.
describe('AuditLog write-paths (e2e)', () => {
  let app: INestApplication;
  let members: MembersService;
  let staff: StaffService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    members = moduleFixture.get(MembersService);
    staff = moduleFixture.get(StaffService);
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs member.created the first time a member is created via findOrCreateFromIdentity', async () => {
    const externalId = `audit-e2e-${Date.now()}`;
    const member = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const entries = await prisma.auditLog.findMany({
      where: { action: 'member.created', targetId: member.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].targetMemberId).toBe(member.id);

    // Logging in again (existing identity) must NOT create a second entry.
    await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    const entriesAfterSecondLogin = await prisma.auditLog.findMany({
      where: { action: 'member.created', targetId: member.id },
    });
    expect(entriesAfterSecondLogin).toHaveLength(1);
  });

  it('logs staff.role_granted and staff.role_revoked with the granting/revoking actor', async () => {
    const suffix = Date.now();
    const [granter, grantee] = await Promise.all([
      prisma.staffUser.create({ data: { email: `granter-${suffix}@example.com`, name: 'Granter' } }),
      prisma.staffUser.create({ data: { email: `grantee-${suffix}@example.com`, name: 'Grantee' } }),
    ]);

    await staff.grantRole({ staffUserId: grantee.id, roleName: 'Analytics Viewer', grantedById: granter.id });

    const grantEntries = await prisma.auditLog.findMany({
      where: { action: 'staff.role_granted', targetId: grantee.id },
    });
    expect(grantEntries).toHaveLength(1);
    expect(grantEntries[0].actorStaffUserId).toBe(granter.id);
    expect((grantEntries[0].metadata as { roleName: string }).roleName).toBe('Analytics Viewer');

    await staff.revokeRole({ staffUserId: grantee.id, roleName: 'Analytics Viewer', revokedById: granter.id });

    const revokeEntries = await prisma.auditLog.findMany({
      where: { action: 'staff.role_revoked', targetId: grantee.id },
    });
    expect(revokeEntries).toHaveLength(1);
    expect(revokeEntries[0].actorStaffUserId).toBe(granter.id);
  });
});
