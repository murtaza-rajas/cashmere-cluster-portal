import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException, NotFoundException } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { DataSubjectRequestsService } from '../src/data-subject-requests/data-subject-requests.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DataSubjectRequestType } from '@prisma/client';

// Proves the staff-facing GDPR request queue (findPending/complete) actually works
// against a real database, and that completing writes the compliance audit trail —
// see schema.prisma's DataSubjectRequest comment and PROJECT_TRACKER.md Section 4.
describe('DataSubjectRequests write-paths (e2e)', () => {
  let app: INestApplication;
  let service: DataSubjectRequestsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get(DataSubjectRequestsService);
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createPendingRequest() {
    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        shopifyCustomerId: `dsr-e2e-${suffix}`,
        email: `dsr-e2e-${suffix}@example.com`,
        membershipTier: 'NEWSLETTER',
      },
    });
    const request = await prisma.dataSubjectRequest.create({
      data: { memberId: member.id, type: DataSubjectRequestType.ACCESS },
    });
    return { member, request };
  }

  it('findPending only returns PENDING requests, oldest first', async () => {
    const { request: older } = await createPendingRequest();
    const { request: newer } = await createPendingRequest();

    const pending = await service.findPending();
    const ids = pending.map((r) => r.id);
    expect(ids).toContain(older.id);
    expect(ids).toContain(newer.id);
    expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
  });

  it('complete marks the request COMPLETED and writes an audit log entry', async () => {
    const { member, request } = await createPendingRequest();
    const staffActor = await prisma.staffUser.create({
      data: { email: `dsr-actor-${Date.now()}@example.com`, name: 'DSR Actor' },
    });

    const updated = await service.complete({
      id: request.id,
      staffUserId: staffActor.id,
      reason: 'Emailed export to member',
    });

    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedAt).not.toBeNull();

    const stillPending = await service.findPending();
    expect(stillPending.map((r) => r.id)).not.toContain(request.id);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'data_subject_request.completed', targetId: request.id },
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].actorStaffUserId).toBe(staffActor.id);
    expect(auditEntries[0].targetMemberId).toBe(member.id);
    expect(auditEntries[0].reason).toBe('Emailed export to member');
  });

  it('complete throws NotFoundException for an unknown id', async () => {
    const staffActor = await prisma.staffUser.create({
      data: { email: `dsr-actor-${Date.now()}-2@example.com`, name: 'DSR Actor' },
    });
    await expect(
      service.complete({ id: 'does-not-exist', staffUserId: staffActor.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('complete throws ConflictException if already completed', async () => {
    const { request } = await createPendingRequest();
    const staffActor = await prisma.staffUser.create({
      data: { email: `dsr-actor-${Date.now()}-3@example.com`, name: 'DSR Actor' },
    });

    await service.complete({ id: request.id, staffUserId: staffActor.id });
    await expect(
      service.complete({ id: request.id, staffUserId: staffActor.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
