import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransactionalEmailService } from '../src/email/transactional-email.service';
import { createTestApp } from './test-app.util';

// Email sign-in: code request + verify. The email sender is mocked (no real
// Mailchimp call); everything else — limits, hashing, sessions — runs for real.
describe('Email sign-in (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sendSpy: jest.SpyInstance;
  const sent: { to: string; text: string }[] = [];
  let ipCounter = 0;
  const ip = () => `198.51.100.${(ipCounter += 1) % 250}, 10.0.0.1`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sendSpy = jest
      .spyOn(app.get(TransactionalEmailService), 'send')
      .mockImplementation(async (email) => {
        sent.push({ to: email.to, text: email.text });
      });
  });

  afterAll(async () => {
    sendSpy.mockRestore();
    await app.close();
  });

  async function newMember(tag: string, extra: object = {}) {
    const id = `email-login-e2e-${tag}-${Date.now()}-${Math.random()}`;
    return prisma.member.create({
      data: { shopifyCustomerId: id, email: `${id}@example.com`, membershipTier: 'NEWSLETTER', ...extra },
    });
  }

  const requestCode = (email: string, forwardedFor = ip()) =>
    request(app.getHttpServer()).post('/auth/email/request').set('X-Forwarded-For', forwardedFor).send({ email });
  const verify = (email: string, code: string) =>
    request(app.getHttpServer()).post('/auth/email/verify').send({ email, code });
  const lastCodeFor = (email: string) => {
    const m = [...sent].reverse().find((s) => s.to.toLowerCase() === email.toLowerCase());
    return m ? /code is (\d{6})/.exec(m.text)![1] : null;
  };

  it('a member requests a code by email and signs in with it (case-insensitive), getting a normal session', async () => {
    const member = await newMember('happy', { membershipTier: 'ANNUAL' });
    const res = await requestCode(member.email.toUpperCase()).expect(202);
    expect(res.body.message).toMatch(/if this email belongs to a member/i);

    const code = lastCodeFor(member.email);
    expect(code).toMatch(/^\d{6}$/);

    const ok = await verify(member.email, code!).expect(200);
    const cookie = ok.headers['set-cookie'] as unknown as string[];
    expect(cookie.join(';')).toMatch(/clc_session=/);

    const me = await request(app.getHttpServer())
      .get('/members/me')
      .set('Cookie', cookie.map((c) => c.split(';')[0]).join('; '))
      .expect(200);
    expect(me.body.id).toBe(member.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'member.signed_in_email', targetMemberId: member.id },
    });
    expect(audit).not.toBeNull();

    // A used code can't be used again.
    await verify(member.email, code!).expect(400);
  });

  it('gives the same answer for a non-member and sends nothing', async () => {
    const email = `email-login-e2e-nobody-${Date.now()}@example.com`;
    const before = sent.length;
    const res = await requestCode(email).expect(202);
    expect(res.body.message).toMatch(/if this email belongs to a member/i);
    expect(sent.length).toBe(before);
    await verify(email, '123456').expect(400);
  });

  it('rejects wrong codes, and locks the code after 5 attempts', async () => {
    const member = await newMember('attempts');
    await requestCode(member.email).expect(202);
    const code = lastCodeFor(member.email)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await verify(member.email, wrong).expect(400);
    await verify(member.email, code).expect(400);
  });

  it('rejects an expired code', async () => {
    const member = await newMember('expired');
    await requestCode(member.email).expect(202);
    const code = lastCodeFor(member.email)!;
    await prisma.emailLoginCode.updateMany({
      where: { email: member.email.toLowerCase() },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await verify(member.email, code).expect(400);
  });

  it('limits how often codes can be requested', async () => {
    const member = await newMember('cooldown');
    await requestCode(member.email).expect(202);
    await requestCode(member.email).expect(429);

    // Per-email hourly limit: backdate earlier requests past the cooldown.
    await prisma.emailLoginCode.updateMany({
      where: { email: member.email.toLowerCase() },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
    });
    for (let i = 0; i < 4; i++) {
      await requestCode(member.email).expect(202);
      await prisma.emailLoginCode.updateMany({
        where: { email: member.email.toLowerCase() },
        data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
      });
    }
    await requestCode(member.email).expect(429);
  });

  it('limits requests per IP address', async () => {
    const sameIp = `203.0.113.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 20; i++) {
      await requestCode(`email-login-e2e-ip-${i}-${Date.now()}@example.com`, sameIp).expect(202);
    }
    await requestCode(`email-login-e2e-ip-over-${Date.now()}@example.com`, sameIp).expect(429);
  });

  it('does not sign in demo/preview accounts by email', async () => {
    const email = `email-login-e2e-demo-${Date.now()}@example.com`;
    await prisma.member.create({
      data: { shopifyCustomerId: `demo-${email}`, email, membershipTier: 'FOUNDING' },
    });
    const before = sent.length;
    await requestCode(email).expect(202);
    expect(sent.length).toBe(before);
  });

  it('validates input', async () => {
    await request(app.getHttpServer()).post('/auth/email/request').send({ email: 'not-an-email' }).expect(400);
    await request(app.getHttpServer()).post('/auth/email/verify').send({ email: 'a@example.com', code: 'abc' }).expect(400);
  });

  it('reports whether email sign-in can send emails (the panel hides it otherwise)', async () => {
    const res = await request(app.getHttpServer()).get('/auth/email/status').expect(200);
    expect(typeof res.body.available).toBe('boolean');
  });
});
