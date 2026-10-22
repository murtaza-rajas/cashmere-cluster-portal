import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransactionalEmailService } from '../src/email/transactional-email.service';
import { createTestApp } from './test-app.util';

// Staff sign-in by email code: /auth/staff-email/request + verify. The email
// sender is mocked; codes, limits and the staff session run for real.
describe('Staff email sign-in (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sendSpy: jest.SpyInstance;
  const sent: { to: string; subject: string; text: string }[] = [];
  let ipCounter = 0;
  const ip = () => `192.0.2.${(ipCounter += 1) % 250}, 10.0.0.1`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sendSpy = jest
      .spyOn(app.get(TransactionalEmailService), 'send')
      .mockImplementation(async (email) => {
        sent.push({ to: email.to, subject: email.subject, text: email.text });
      });
  });

  afterAll(async () => {
    sendSpy.mockRestore();
    await app.close();
  });

  const uniqueEmail = (tag: string) =>
    `staff-email-e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  async function newStaff(tag: string, extra: object = {}, role?: string) {
    const staff = await prisma.staffUser.create({
      data: { email: uniqueEmail(tag), name: `Test ${tag}`, ...extra },
    });
    if (role) {
      const r = await prisma.role.findUniqueOrThrow({ where: { name: role } });
      await prisma.staffRoleAssignment.create({
        data: { staffUserId: staff.id, roleId: r.id },
      });
    }
    return staff;
  }

  const requestCode = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/staff-email/request')
      .set('X-Forwarded-For', ip())
      .send({ email });
  const verify = (email: string, code: string) =>
    request(app.getHttpServer())
      .post('/auth/staff-email/verify')
      .send({ email, code });
  const lastCodeFor = (email: string) => {
    const m = [...sent]
      .reverse()
      .find((s) => s.to.toLowerCase() === email.toLowerCase());
    return m ? /code is (\d{6})/.exec(m.text)![1] : null;
  };

  it('an active staff member signs in with an emailed code and gets a working staff session', async () => {
    const staff = await newStaff('happy', {}, 'Super Administrator');
    const res = await requestCode(staff.email.toUpperCase()).expect(202);
    expect(res.body.message).toMatch(
      /if this email belongs to a staff account/i,
    );

    const code = lastCodeFor(staff.email);
    expect(code).toMatch(/^\d{6}$/);
    expect(sent[sent.length - 1].subject).toMatch(/admin sign-in code/i);

    const ok = await verify(staff.email, code!).expect(200);
    const cookies = ok.headers['set-cookie'] as unknown as string[];
    const staffCookie = cookies.find((c) => c.startsWith('clc_staff_session='));
    expect(staffCookie).toBeDefined();
    expect(cookies.some((c) => c.startsWith('clc_session='))).toBe(false);

    const me = await request(app.getHttpServer())
      .get('/staff/me')
      .set('Cookie', staffCookie!.split(';')[0])
      .expect(200);
    expect(me.body.id).toBe(staff.id);
    expect(me.body.roles).toContain('Super Administrator');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'staff.signed_in_email', actorStaffUserId: staff.id },
    });
    expect(audit).not.toBeNull();

    await verify(staff.email, code!).expect(400);
  });

  it('sends nothing to unknown, inactive or expired staff accounts, with the same answer', async () => {
    const inactive = await newStaff('inactive', { isActive: false });
    const expired = await newStaff('expired', {
      expiryDate: new Date(Date.now() - 60_000),
    });
    const before = sent.length;
    for (const email of [
      uniqueEmail('nobody'),
      inactive.email,
      expired.email,
    ]) {
      const res = await requestCode(email).expect(202);
      expect(res.body.message).toMatch(
        /if this email belongs to a staff account/i,
      );
    }
    expect(sent.length).toBe(before);
    await verify(inactive.email, '123456').expect(400);
  });

  it('keeps member and staff codes apart for the same email', async () => {
    const staff = await newStaff('both');
    await prisma.member.create({
      data: {
        shopifyCustomerId: `staff-email-e2e-${Date.now()}`,
        email: staff.email,
        membershipTier: 'ANNUAL',
      },
    });

    await request(app.getHttpServer())
      .post('/auth/email/request')
      .set('X-Forwarded-For', ip())
      .send({ email: staff.email })
      .expect(202);
    const memberCode = lastCodeFor(staff.email)!;
    expect(sent[sent.length - 1].subject).toMatch(
      /Cashmere Lovers' Club sign-in code/,
    );

    // A member code doesn't open the Admin; the staff request isn't blocked
    // by the member request's cooldown.
    await verify(staff.email, memberCode).expect(400);
    await requestCode(staff.email).expect(202);
    const staffCode = lastCodeFor(staff.email)!;
    await verify(staff.email, staffCode).expect(200);
  });

  it('applies the resend cooldown and attempt limit to staff codes', async () => {
    const staff = await newStaff('limits');
    await requestCode(staff.email).expect(202);
    await requestCode(staff.email).expect(429);

    const code = lastCodeFor(staff.email)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await verify(staff.email, wrong).expect(400);
    await verify(staff.email, code).expect(400);
  });
});
