import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailchimpService } from '../src/mailchimp/mailchimp.service';
import { createTestApp } from './test-app.util';

// Communication / Newsletter (Milestone 5): staff CRUD at
// /newsletter-campaigns, Newsletter Manager only. Deliberately no "send"
// endpoint and no SENT status — Mailchimp access doesn't exist yet (see
// PROJECT_TRACKER.md's 2026-09-15 blocker list), so a campaign only ever
// reaches READY_TO_SEND. This suite covers the real, unblocked part: draft
// authoring, audience targeting, scheduling metadata, and the audit trail.
describe('Newsletter campaigns (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  // No real campaigns exist yet (this whole feature is new as of
  // 2026-09-19) — safe to wipe entirely, same reasoning applied to every
  // other content-model spec during the 2026-09-21 e2e cleanup audit.
  afterAll(async () => {
    await prisma.newsletterCampaign.deleteMany();
    await app.close();
  });

  async function staffCookieFor(roleName: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });
    const staff = await prisma.staffUser.create({
      data: {
        email: `newsletter-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('POST /newsletter-campaigns: 401 with no session, 403 for a role without access, 201 with the audit trail for Newsletter Manager', async () => {
    await request(app.getHttpServer())
      .post('/newsletter-campaigns')
      .send({ subject: 'Test', audienceTiers: ['FOUNDING'] })
      .expect(401);

    await request(app.getHttpServer())
      .post('/newsletter-campaigns')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .send({ subject: 'Test', audienceTiers: ['FOUNDING'] })
      .expect(403);

    const managerCookie = await staffCookieFor('Newsletter Manager');
    const created = await request(app.getHttpServer())
      .post('/newsletter-campaigns')
      .set('Cookie', managerCookie)
      .send({
        subject: 'October Founding update',
        body: 'A note for Founding members.',
        audienceTiers: ['FOUNDING'],
      })
      .expect(201);

    expect(created.body.subject).toBe('October Founding update');
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.audienceTiers).toEqual(['FOUNDING']);

    const auditEntries = await prisma.auditLog.findMany({
      where: {
        action: 'newsletter_campaign.created',
        targetId: created.body.id,
      },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH /newsletter-campaigns/:id updates the row (including moving it to READY_TO_SEND) and writes an audit entry; DELETE removes it', async () => {
    const managerCookie = await staffCookieFor('Newsletter Manager');
    const created = await request(app.getHttpServer())
      .post('/newsletter-campaigns')
      .set('Cookie', managerCookie)
      .send({
        subject: 'Draft campaign',
        audienceTiers: [],
      })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');

    const updated = await request(app.getHttpServer())
      .patch(`/newsletter-campaigns/${created.body.id}`)
      .set('Cookie', managerCookie)
      .send({
        audienceTiers: ['FOUNDING', 'ANNUAL'],
        status: 'READY_TO_SEND',
        scheduledFor: '2026-10-01T09:00:00.000Z',
      })
      .expect(200);
    expect(updated.body.status).toBe('READY_TO_SEND');
    expect(updated.body.audienceTiers).toEqual(['FOUNDING', 'ANNUAL']);
    expect(updated.body.scheduledFor).toBe('2026-10-01T09:00:00.000Z');

    const auditEntries = await prisma.auditLog.findMany({
      where: {
        action: 'newsletter_campaign.updated',
        targetId: created.body.id,
      },
    });
    expect(auditEntries).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/newsletter-campaigns/${created.body.id}`)
      .set('Cookie', managerCookie)
      .expect(200);

    const stillExists = await prisma.newsletterCampaign.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
  });

  it('PATCH /newsletter-campaigns/:id: 404 for an unknown id', async () => {
    const managerCookie = await staffCookieFor('Newsletter Manager');
    await request(app.getHttpServer())
      .patch('/newsletter-campaigns/does-not-exist')
      .set('Cookie', managerCookie)
      .send({ subject: 'Anything' })
      .expect(404);
  });

  it('GET /newsletter-campaigns: 401 with no session, 403 for a role without access', async () => {
    await request(app.getHttpServer()).get('/newsletter-campaigns').expect(401);

    await request(app.getHttpServer())
      .get('/newsletter-campaigns')
      .set('Cookie', await staffCookieFor('Content Manager'))
      .expect(403);
  });

  describe('Create in Mailchimp', () => {
    let saveSpy: jest.SpyInstance;
    const calls: Parameters<MailchimpService['saveDraftCampaign']>[0][] = [];

    beforeAll(() => {
      saveSpy = jest
        .spyOn(app.get(MailchimpService), 'saveDraftCampaign')
        .mockImplementation(async (params) => {
          calls.push(params);
          return {
            id: params.existingId ?? 'mc-abc123',
            webId: 4242,
            editUrl: 'https://us8.admin.mailchimp.com/campaigns/edit?id=4242',
          };
        });
    });

    afterAll(() => saveSpy.mockRestore());

    async function campaign(cookie: string, body: object) {
      const res = await request(app.getHttpServer())
        .post('/newsletter-campaigns')
        .set('Cookie', cookie)
        .send(body)
        .expect(201);
      return res.body as { id: string };
    }

    it('creates a ready campaign as a Mailchimp draft, then updates the same draft', async () => {
      const cookie = await staffCookieFor('Newsletter Manager');
      const { id } = await campaign(cookie, {
        subject: 'The Club opens on 1 November',
        body: 'Dear member,\n\nThe Club opens soon <3\nSee you there.',
        audienceTiers: ['NEWSLETTER', 'ANNUAL'],
        audienceRegions: ['INTERNATIONAL'],
        status: 'READY_TO_SEND',
      });

      const first = await request(app.getHttpServer())
        .post(`/newsletter-campaigns/${id}/mailchimp`)
        .set('Cookie', cookie)
        .expect(201);
      expect(first.body.mailchimpCampaignId).toBe('mc-abc123');
      expect(first.body.mailchimpWebId).toBe(4242);
      expect(first.body.mailchimpEditUrl).toMatch(/admin\.mailchimp\.com/);
      expect(first.body.mailchimpSyncedAt).toBe(first.body.updatedAt);

      const sent = calls[calls.length - 1];
      expect(sent.existingId).toBeNull();
      expect(sent.subject).toBe('The Club opens on 1 November');
      expect(sent.title).toBe(
        'CLC: The Club opens on 1 November (intended for Newsletter, Annual – International)',
      );
      // Paragraphs and line breaks kept, text escaped.
      expect(sent.html).toContain('Dear member,</p>');
      expect(sent.html).toContain(
        'The Club opens soon &lt;3<br>See you there.',
      );

      await request(app.getHttpServer())
        .post(`/newsletter-campaigns/${id}/mailchimp`)
        .set('Cookie', cookie)
        .expect(201);
      expect(calls[calls.length - 1].existingId).toBe('mc-abc123');

      const audit = await prisma.auditLog.findMany({
        where: {
          targetId: id,
          action: { startsWith: 'newsletter_campaign.mailchimp' },
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(audit.map((a) => a.action)).toEqual([
        'newsletter_campaign.mailchimp_created',
        'newsletter_campaign.mailchimp_updated',
      ]);
    });

    it('refuses drafts and empty campaigns, and other roles', async () => {
      const cookie = await staffCookieFor('Newsletter Manager');
      const draft = await campaign(cookie, {
        subject: 'Not ready',
        audienceTiers: ['ANNUAL'],
        body: 'Hi',
      });
      const before = calls.length;
      await request(app.getHttpServer())
        .post(`/newsletter-campaigns/${draft.id}/mailchimp`)
        .set('Cookie', cookie)
        .expect(400);

      const empty = await campaign(cookie, {
        subject: 'No text',
        audienceTiers: ['ANNUAL'],
        status: 'READY_TO_SEND',
      });
      await request(app.getHttpServer())
        .post(`/newsletter-campaigns/${empty.id}/mailchimp`)
        .set('Cookie', cookie)
        .expect(400);
      expect(calls.length).toBe(before);

      await request(app.getHttpServer())
        .post(`/newsletter-campaigns/${draft.id}/mailchimp`)
        .set('Cookie', await staffCookieFor('Content Manager'))
        .expect(403);
    });
  });
});
