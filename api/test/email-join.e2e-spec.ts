import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransactionalEmailService } from '../src/email/transactional-email.service';
import { MailchimpService } from '../src/mailchimp/mailchimp.service';
import { ShopifyAdminApiService } from '../src/shopify-admin/shopify-admin-api.service';
import { createTestApp } from './test-app.util';

// "Join for free" on the sign-in panel: POST /auth/email/join. Email,
// Mailchimp and Shopify are mocked; members, limits and codes run for real.
describe('Join for free (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const spies: jest.SpyInstance[] = [];
  const sent: { to: string; text: string }[] = [];
  const mailchimpCalls: { email: string; firstName?: string | null }[] = [];
  const shopifyCalls: string[] = [];
  let mailchimpFails = false;
  let ipCounter = 0;
  const ip = () => `198.18.0.${(ipCounter += 1) % 250}, 10.0.0.1`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    spies.push(
      jest
        .spyOn(app.get(TransactionalEmailService), 'send')
        .mockImplementation(async (email) => {
          sent.push({ to: email.to, text: email.text });
        }),
      jest
        .spyOn(app.get(MailchimpService), 'addPendingSubscriber')
        .mockImplementation(async (person) => {
          mailchimpCalls.push(person);
          if (mailchimpFails) throw new Error('Mailchimp down');
        }),
      jest
        .spyOn(app.get(ShopifyAdminApiService), 'findOrCreateCustomer')
        .mockImplementation(async (person) => {
          shopifyCalls.push(person.email);
          return {
            customerId: `join-e2e-${Date.now()}-${Math.random()}`,
            created: true,
          };
        }),
    );
  });

  afterAll(async () => {
    spies.forEach((s) => s.mockRestore());
    await app.close();
  });

  const newEmail = (tag: string) =>
    `join-e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const join = (body: object, forwardedFor = ip()) =>
    request(app.getHttpServer())
      .post('/auth/email/join')
      .set('X-Forwarded-For', forwardedFor)
      .send(body);
  const lastCodeFor = (email: string) => {
    const m = [...sent]
      .reverse()
      .find((s) => s.to.toLowerCase() === email.toLowerCase());
    return m ? /code is (\d{6})/.exec(m.text)![1] : null;
  };

  it('a new person joins: Newsletter member, pending in Mailchimp, consent recorded, code sent, can sign in', async () => {
    const email = newEmail('new');
    const res = await join({
      email,
      firstName: '  Anna ',
      newsletterConsent: true,
    }).expect(202);
    expect(res.body.message).toMatch(/sign-in code/i);

    expect(mailchimpCalls[mailchimpCalls.length - 1]).toEqual({
      email,
      firstName: 'Anna',
    });
    expect(shopifyCalls).toContain(email);

    const member = await prisma.member.findFirstOrThrow({ where: { email } });
    expect(member.membershipTier).toBe('NEWSLETTER');
    expect(member.firstName).toBe('Anna');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'member.joined', targetMemberId: member.id },
    });
    expect(audit.metadata).toMatchObject({
      memberCreated: true,
      mailchimp: 'pending',
      newsletterConsent: expect.stringMatching(/newsletter/i),
    });

    const code = lastCodeFor(email);
    expect(code).toMatch(/^\d{6}$/);
    const ok = await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({ email, code })
      .expect(200);
    expect((ok.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
      /clc_session=/,
    );
  });

  it('an existing member who joins just gets a code — no new account, same answer', async () => {
    const email = newEmail('existing');
    const existing = await prisma.member.create({
      data: {
        shopifyCustomerId: `join-e2e-existing-${Date.now()}`,
        email,
        membershipTier: 'ANNUAL',
      },
    });
    const shopifyBefore = shopifyCalls.length;

    const res = await join({
      email: email.toUpperCase(),
      firstName: 'Bo',
      newsletterConsent: true,
    }).expect(202);
    expect(res.body.message).toMatch(/sign-in code/i);
    expect(shopifyCalls.length).toBe(shopifyBefore);
    expect(await prisma.member.count({ where: { email } })).toBe(1);
    const unchanged = await prisma.member.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(unchanged.membershipTier).toBe('ANNUAL');
    expect(lastCodeFor(email)).toMatch(/^\d{6}$/);
  });

  it('still joins when Mailchimp is down, recording that it failed', async () => {
    mailchimpFails = true;
    const email = newEmail('mc-down');
    try {
      await join({ email, firstName: 'Cleo', newsletterConsent: true }).expect(
        202,
      );
    } finally {
      mailchimpFails = false;
    }
    const member = await prisma.member.findFirstOrThrow({ where: { email } });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'member.joined', targetMemberId: member.id },
    });
    expect(audit.metadata).toMatchObject({ mailchimp: 'failed' });
  });

  it('requires consent, a name and a valid email', async () => {
    const before = shopifyCalls.length;
    await join({
      email: newEmail('v'),
      firstName: 'D',
      newsletterConsent: false,
    }).expect(400);
    await join({ email: newEmail('v'), firstName: 'D' }).expect(400);
    await join({
      email: newEmail('v'),
      firstName: ' ',
      newsletterConsent: true,
    }).expect(400);
    await join({
      email: 'nope',
      firstName: 'D',
      newsletterConsent: true,
    }).expect(400);
    expect(shopifyCalls.length).toBe(before);
  });

  it('checks the limits before creating anything', async () => {
    const sameIp = `203.0.113.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .post('/auth/email/request')
        .set('X-Forwarded-For', sameIp)
        .send({ email: newEmail(`ip${i}`) })
        .expect(202);
    }
    const before = { shopify: shopifyCalls.length, mc: mailchimpCalls.length };
    const email = newEmail('limited');
    await join(
      { email, firstName: 'Eve', newsletterConsent: true },
      sameIp,
    ).expect(429);
    expect(shopifyCalls.length).toBe(before.shopify);
    expect(mailchimpCalls.length).toBe(before.mc);
    expect(await prisma.member.count({ where: { email } })).toBe(0);
  });
});
