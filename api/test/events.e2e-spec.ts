import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { join } from 'path';
import { promises as fs } from 'fs';
import { PrismaService } from '../src/prisma/prisma.service';
import { MembersService } from '../src/members/members.service';
import { createTestApp } from './test-app.util';

const FIXTURE_IMAGE = join(__dirname, 'fixtures', 'test-image.jpg');
const FIXTURE_SVG = join(__dirname, 'fixtures', 'test-payload.svg');

// Events & Invitations (Milestone 5): staff CRUD + image upload at
// /event-catalog (Event Manager — see events.controller.ts's comment), and
// the member-facing read at /members/me/events, scoped to the member's own
// tier and active rows only.
describe('Event catalog (e2e)', () => {
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
        email: `events-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  it('POST /event-catalog: 401 with no session, 403 for a role without access, 201 with the audit trail for Event Manager', async () => {
    await request(app.getHttpServer())
      .post('/event-catalog')
      .send({
        title: 'Test event',
        locationType: 'ONLINE',
        tiers: ['FOUNDING'],
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .send({
        title: 'Test event',
        locationType: 'ONLINE',
        tiers: ['FOUNDING'],
      })
      .expect(403);

    const eventManagerCookie = await staffCookieFor('Event Manager');
    const created = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Mongolia Evening — Meet the Producers',
        description: 'An evening with the herders and artisans.',
        locationType: 'IN_PERSON',
        location: 'Oslo showroom',
        tiers: ['FOUNDING', 'ANNUAL'],
      })
      .expect(201);

    expect(created.body.title).toBe('Mongolia Evening — Meet the Producers');
    expect(created.body.locationType).toBe('IN_PERSON');
    expect(created.body.tiers).toEqual(['FOUNDING', 'ANNUAL']);
    expect(created.body.active).toBe(true);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'event.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('PATCH /event-catalog/:id updates the row and writes an audit entry; DELETE removes it', async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');
    const created = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Draft event',
        locationType: 'ONLINE',
        tiers: [],
        active: false,
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/event-catalog/${created.body.id}`)
      .set('Cookie', eventManagerCookie)
      .send({ active: true, registrationUrl: 'https://example.com/register' })
      .expect(200);
    expect(updated.body.active).toBe(true);
    expect(updated.body.registrationUrl).toBe('https://example.com/register');

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'event.updated', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/event-catalog/${created.body.id}`)
      .set('Cookie', eventManagerCookie)
      .expect(200);

    const stillExists = await prisma.event.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
  });

  it('PATCH /event-catalog/:id: 404 for an unknown id', async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');
    await request(app.getHttpServer())
      .patch('/event-catalog/does-not-exist')
      .set('Cookie', eventManagerCookie)
      .send({ title: 'Anything' })
      .expect(404);
  });

  it('POST /event-catalog/:id/image uploads a real file; uploading again replaces it; DELETE removes it', async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');
    const created = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Event with photo',
        locationType: 'IN_PERSON',
        tiers: ['FOUNDING'],
      })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post(`/event-catalog/${created.body.id}/image`)
      .set('Cookie', eventManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.imageUrl).toMatch(/^\/uploads\/events\/.+\.jpg$/);
    const firstPath = join(process.cwd(), uploaded.body.imageUrl.slice(1));
    await expect(fs.stat(firstPath)).resolves.toBeDefined();

    const replaced = await request(app.getHttpServer())
      .post(`/event-catalog/${created.body.id}/image`)
      .set('Cookie', eventManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(replaced.body.imageUrl).not.toBe(uploaded.body.imageUrl);
    await expect(fs.stat(firstPath)).rejects.toThrow();

    const auditReplaced = await prisma.auditLog.findMany({
      where: { action: 'event.image_replaced', targetId: created.body.id },
    });
    expect(auditReplaced).toHaveLength(1);

    const secondPath = join(process.cwd(), replaced.body.imageUrl.slice(1));
    await request(app.getHttpServer())
      .delete(`/event-catalog/${created.body.id}/image`)
      .set('Cookie', eventManagerCookie)
      .expect(200);
    await expect(fs.stat(secondPath)).rejects.toThrow();

    const finalRow = await prisma.event.findUnique({
      where: { id: created.body.id },
    });
    expect(finalRow!.imageUrl).toBeNull();
  });

  // Regression test for a real stored-XSS finding (2026-09-09 security
  // review) — see the matching test in site-images.e2e-spec.ts for the full
  // explanation. Same fileFilter util, same fix, exercised here too since
  // this is a separate upload endpoint.
  it('POST /event-catalog/:id/image rejects an SVG upload (stored-XSS vector) with 400', async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');
    const created = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: `SVG Upload Test ${Date.now()}`,
        locationType: 'IN_PERSON',
        tiers: ['FOUNDING'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/event-catalog/${created.body.id}/image`)
      .set('Cookie', eventManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);
  });

  it("GET /members/me/events only returns active events visible to the member's own tier", async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');

    const foundingOnlyEvent = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Founding-only event',
        locationType: 'ONLINE',
        tiers: ['FOUNDING'],
      })
      .expect(201);
    const annualOnlyEvent = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Annual-only event',
        locationType: 'ONLINE',
        tiers: ['ANNUAL'],
      })
      .expect(201);
    const inactiveFoundingEvent = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Inactive event',
        locationType: 'ONLINE',
        tiers: ['FOUNDING'],
        active: false,
      })
      .expect(201);

    const externalId = `events-e2e-member-${Date.now()}`;
    const foundingMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: foundingMember.id },
      data: { membershipTier: 'FOUNDING' },
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/events')
      .set('Cookie', sessionCookieFor(foundingMember.id))
      .expect(200);
    const ids = res.body.map((e: { id: string }) => e.id);
    expect(ids).toContain(foundingOnlyEvent.body.id);
    expect(ids).not.toContain(annualOnlyEvent.body.id);
    expect(ids).not.toContain(inactiveFoundingEvent.body.id);
  });

  // Regression test (2026-09-11) — same fix and reasoning as the equivalent
  // Benefit test: tier alone can't tell a Mongolia Newsletter member apart
  // from an international one (both carry tier NEWSLETTER), found while
  // reusing Event for Mongolia's own Events section.
  it("a Mongolia-only event is visible to Mongolia Newsletter but not to an international Newsletter Subscriber", async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');

    const mongoliaOnlyEvent = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({
        title: 'Ulaanbaatar Cashmere Festival',
        locationType: 'IN_PERSON',
        tiers: ['NEWSLETTER'],
        regions: ['MONGOLIA'],
      })
      .expect(201);
    expect(mongoliaOnlyEvent.body.regions).toEqual(['MONGOLIA']);

    const mongoliaNewsletterId = `events-e2e-mn-newsletter-${Date.now()}`;
    const mongoliaNewsletter = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId: mongoliaNewsletterId,
      email: `${mongoliaNewsletterId}@example.com`,
    });
    await prisma.member.update({
      where: { id: mongoliaNewsletter.id },
      data: { membershipTier: 'NEWSLETTER', region: 'MONGOLIA' },
    });

    const internationalNewsletterId = `events-e2e-intl-newsletter-${Date.now()}`;
    const internationalNewsletter = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId: internationalNewsletterId,
      email: `${internationalNewsletterId}@example.com`,
    });
    await prisma.member.update({
      where: { id: internationalNewsletter.id },
      data: { membershipTier: 'NEWSLETTER', region: 'INTERNATIONAL' },
    });

    const mongoliaRes = await request(app.getHttpServer())
      .get('/members/me/events')
      .set('Cookie', sessionCookieFor(mongoliaNewsletter.id))
      .expect(200);
    expect(mongoliaRes.body.map((e: { id: string }) => e.id)).toContain(
      mongoliaOnlyEvent.body.id,
    );

    const internationalRes = await request(app.getHttpServer())
      .get('/members/me/events')
      .set('Cookie', sessionCookieFor(internationalNewsletter.id))
      .expect(200);
    expect(
      internationalRes.body.map((e: { id: string }) => e.id),
    ).not.toContain(mongoliaOnlyEvent.body.id);
  });

  // Mongolia Editor (2026-09-11) — the first regional/community role, see
  // region-scope.util.ts. A Mongolia Editor can reach /event-catalog (same
  // backend as Event Manager, per the client's "reuse the existing CLC
  // admin components" instruction), but only ever create Mongolia-only
  // rows, and can never read/edit/delete a row that isn't confined exactly
  // to Mongolia — an international-visible event is genuinely out of
  // their scope, not just hidden by the frontend.
  it('Mongolia Editor can only create/see Mongolia-only events, and gets 403 touching an international one', async () => {
    const eventManagerCookie = await staffCookieFor('Event Manager');
    const mongoliaEditorCookie = await staffCookieFor('Mongolia Editor');

    // Mongolia Editor's own create is forced into Mongolia scope even if
    // they never set `regions` at all.
    const created = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', mongoliaEditorCookie)
      .send({ title: 'Naadam Gathering', locationType: 'IN_PERSON', tiers: ['MONGOLIA'] })
      .expect(201);
    expect(created.body.regions).toEqual(['MONGOLIA']);

    // A pre-existing international event (Event Manager's own default
    // scope, [INTERNATIONAL, MONGOLIA]) is invisible to Mongolia Editor's
    // list view and forbidden to touch directly.
    const internationalEvent = await request(app.getHttpServer())
      .post('/event-catalog')
      .set('Cookie', eventManagerCookie)
      .send({ title: 'International Founders Dinner', locationType: 'IN_PERSON', tiers: ['FOUNDING'] })
      .expect(201);

    const editorList = await request(app.getHttpServer())
      .get('/event-catalog')
      .set('Cookie', mongoliaEditorCookie)
      .expect(200);
    const editorIds = editorList.body.map((e: { id: string }) => e.id);
    expect(editorIds).toContain(created.body.id);
    expect(editorIds).not.toContain(internationalEvent.body.id);

    await request(app.getHttpServer())
      .patch(`/event-catalog/${internationalEvent.body.id}`)
      .set('Cookie', mongoliaEditorCookie)
      .send({ title: 'Hijacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/event-catalog/${internationalEvent.body.id}`)
      .set('Cookie', mongoliaEditorCookie)
      .expect(403);

    // Mongolia Editor can freely manage their own Mongolia-only row.
    const updated = await request(app.getHttpServer())
      .patch(`/event-catalog/${created.body.id}`)
      .set('Cookie', mongoliaEditorCookie)
      .send({ title: 'Naadam Gathering — Ulaanbaatar' })
      .expect(200);
    expect(updated.body.title).toBe('Naadam Gathering — Ulaanbaatar');

    await request(app.getHttpServer())
      .delete(`/event-catalog/${created.body.id}`)
      .set('Cookie', mongoliaEditorCookie)
      .expect(200);
  });
});
