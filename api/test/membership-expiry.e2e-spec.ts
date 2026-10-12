import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembershipExpiryService } from '../src/membership-expiry/membership-expiry.service';
import { createTestApp } from './test-app.util';

// Daily expiry of paid memberships whose end date has passed. Calls the
// service directly (the cron/startup trigger is off under NODE_ENV=test).
describe('Membership expiry (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let expiry: MembershipExpiryService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    expiry = app.get(MembershipExpiryService);
  });

  afterAll(async () => {
    await app.close();
  });

  const day = 24 * 60 * 60 * 1000;

  async function member(
    tag: string,
    data: {
      membershipTier: 'FOUNDING' | 'ANNUAL' | 'SIX_MONTH';
      membershipEndDate: Date | null;
      isFoundingMember?: boolean;
    },
  ) {
    const id = `expiry-e2e-${tag}-${Date.now()}-${Math.random()}`;
    return prisma.member.create({
      data: {
        shopifyCustomerId: id,
        email: `${id}@example.com`,
        membershipStartDate: new Date(Date.now() - 400 * day),
        ...data,
      },
    });
  }

  it('moves ended paid memberships back to Newsletter (Founding keeps its badge) and leaves the rest alone', async () => {
    const endedAnnual = await member('annual-ended', {
      membershipTier: 'ANNUAL',
      membershipEndDate: new Date(Date.now() - day),
    });
    const endedFounding = await member('founding-ended', {
      membershipTier: 'FOUNDING',
      isFoundingMember: true,
      membershipEndDate: new Date(Date.now() - day),
    });
    const stillActive = await member('six-month-active', {
      membershipTier: 'SIX_MONTH',
      membershipEndDate: new Date(Date.now() + 30 * day),
    });
    const noEndDate = await member('no-end-date', {
      membershipTier: 'ANNUAL',
      membershipEndDate: null,
    });

    await expiry.expireEndedMemberships();

    const after = async (id: string) =>
      prisma.member.findUniqueOrThrow({ where: { id } });

    expect(await after(endedAnnual.id)).toMatchObject({
      membershipTier: 'NEWSLETTER',
      membershipStatus: 'EXPIRED',
    });
    expect(await after(endedFounding.id)).toMatchObject({
      membershipTier: 'NEWSLETTER',
      membershipStatus: 'EXPIRED',
      isFoundingMember: true,
    });
    expect(await after(stillActive.id)).toMatchObject({
      membershipTier: 'SIX_MONTH',
      membershipStatus: 'ACTIVE',
    });
    expect(await after(noEndDate.id)).toMatchObject({
      membershipTier: 'ANNUAL',
      membershipStatus: 'ACTIVE',
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'member.membership_expired',
        targetMemberId: endedFounding.id,
      },
    });
    expect(audit?.metadata).toMatchObject({ previousTier: 'FOUNDING' });
  });

  it('running again changes nothing for already-expired members', async () => {
    const ended = await member('rerun', {
      membershipTier: 'ANNUAL',
      membershipEndDate: new Date(Date.now() - day),
    });
    await expiry.expireEndedMemberships();
    await expiry.expireEndedMemberships();
    expect(
      await prisma.auditLog.count({
        where: { action: 'member.membership_expired', targetMemberId: ended.id },
      }),
    ).toBe(1);
  });
});
