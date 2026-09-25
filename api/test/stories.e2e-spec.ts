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

// Stories & Knowledge, rebuilt 2026-09-25 into one flexible, reusable
// article structure (client email 2026-09-22/24) — staff CRUD + an ordered
// list of typed sections (TEXT/IMAGE/IMAGE_GALLERY/QUOTE) per story, a real
// draft/publish workflow, and homepage "featured" curation, at
// /story-catalog (Content Manager), member-facing read at
// /members/me/stories (+ /members/me/stories/featured), scoped to the
// member's own tier and PUBLISHED status. Deliberately no region scoping
// (unlike Events/Benefits) — this is the international storiesKnowledge
// area; Mongolia has its own separate MongoliaStory content type.
describe('Story catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let members: MembersService;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    members = app.get(MembersService);
    const category = await prisma.storyCategory.findFirstOrThrow({
      where: { name: 'Story' },
    });
    categoryId = category.id;
  });

  // Same cleanup gap class as before (2026-09-21) — Story/StorySection
  // aren't fixed-key rows, so a leftover is clutter, not an overwrite, but
  // nothing ever removed what this suite created. Wipes both the hero
  // image and every section's IMAGE/IMAGE_GALLERY files.
  afterAll(async () => {
    const leftover = await prisma.story.findMany({
      select: {
        heroImageUrl: true,
        sections: { select: { imageUrl: true, galleryImageUrls: true } },
      },
    });
    const urls = leftover
      .flatMap((s) => [
        s.heroImageUrl,
        ...s.sections.flatMap((sec) => [sec.imageUrl, ...sec.galleryImageUrls]),
      ])
      .filter((u): u is string => Boolean(u));
    await prisma.story.deleteMany();
    await Promise.all(
      urls.map((u) =>
        fs.unlink(join(process.cwd(), u.slice(1))).catch(() => undefined),
      ),
    );
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
        email: `stories-e2e-${roleName.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
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

  async function foundingMemberSession(tag: string) {
    const externalId = `stories-e2e-member-${tag}-${Date.now()}-${Math.random()}`;
    const m = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });
    await prisma.member.update({
      where: { id: m.id },
      data: { membershipTier: 'FOUNDING' },
    });
    return sessionCookieFor(m.id);
  }

  it('POST /story-catalog: 401 with no session, 403 for a role without access, 201 with sections + audit trail for Content Manager', async () => {
    await request(app.getHttpServer())
      .post('/story-catalog')
      .send({
        title: 'Test story',
        categoryId,
        tiers: ['FOUNDING'],
        sections: [],
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', await staffCookieFor('Analytics Viewer'))
      .send({
        title: 'Test story',
        categoryId,
        tiers: ['FOUNDING'],
        sections: [],
      })
      .expect(403);

    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'From Herd to Hem: a Mongolia sourcing story',
        categoryId,
        tiers: ['FOUNDING', 'ANNUAL'],
        status: 'PUBLISHED',
        sections: [
          { order: 0, type: 'TEXT', text: 'The full story body.' },
          {
            order: 1,
            type: 'QUOTE',
            quoteText: 'Every scarf carries a herder’s season.',
          },
        ],
      })
      .expect(201);

    expect(created.body.title).toBe(
      'From Herd to Hem: a Mongolia sourcing story',
    );
    expect(created.body.category.id).toBe(categoryId);
    expect(created.body.tiers).toEqual(['FOUNDING', 'ANNUAL']);
    expect(created.body.status).toBe('PUBLISHED');
    expect(created.body.sections).toHaveLength(2);
    expect(created.body.sections[0]).toMatchObject({
      type: 'TEXT',
      text: 'The full story body.',
      order: 0,
    });
    expect(created.body.sections[1]).toMatchObject({
      type: 'QUOTE',
      quoteText: 'Every scarf carries a herder’s season.',
      order: 1,
    });

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'story.created', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it('a new story defaults to DRAFT status', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Draft story', categoryId, tiers: [], sections: [] })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');
  });

  it('PATCH /story-catalog/:id replaces the whole section list and writes an audit entry; DELETE removes it and its section images', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Section replace test',
        categoryId,
        tiers: [],
        status: 'DRAFT',
        sections: [{ order: 0, type: 'TEXT', text: 'first draft text' }],
      })
      .expect(201);
    expect(created.body.sections).toHaveLength(1);

    const uploaded = await request(app.getHttpServer())
      .post('/story-catalog/section-image')
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.url).toMatch(/^\/uploads\/story-sections\/.+\.jpg$/);
    const sectionImagePath = join(process.cwd(), uploaded.body.url.slice(1));
    await expect(fs.stat(sectionImagePath)).resolves.toBeDefined();

    const updated = await request(app.getHttpServer())
      .patch(`/story-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({
        status: 'PUBLISHED',
        tiers: ['NEWSLETTER'],
        sections: [
          { order: 0, type: 'IMAGE', imageUrl: uploaded.body.url },
          {
            order: 1,
            type: 'IMAGE_GALLERY',
            galleryImageUrls: [uploaded.body.url],
          },
        ],
      })
      .expect(200);
    expect(updated.body.status).toBe('PUBLISHED');
    expect(updated.body.tiers).toEqual(['NEWSLETTER']);
    expect(updated.body.sections).toHaveLength(2);
    expect(updated.body.sections[0]).toMatchObject({
      type: 'IMAGE',
      imageUrl: uploaded.body.url,
    });
    expect(updated.body.sections[1]).toMatchObject({
      type: 'IMAGE_GALLERY',
      galleryImageUrls: [uploaded.body.url],
    });

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'story.updated', targetId: created.body.id },
    });
    expect(auditEntries).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/story-catalog/${created.body.id}`)
      .set('Cookie', contentManagerCookie)
      .expect(200);

    const stillExists = await prisma.story.findUnique({
      where: { id: created.body.id },
    });
    expect(stillExists).toBeNull();
    // The section's image file is cleaned up as part of delete, even though
    // the same URL was referenced twice (once as IMAGE, once inside the
    // gallery) — deleting is idempotent per unique URL either way.
    await expect(fs.stat(sectionImagePath)).rejects.toThrow();
  });

  it('PATCH /story-catalog/:id: 404 for an unknown id', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    await request(app.getHttpServer())
      .patch('/story-catalog/does-not-exist')
      .set('Cookie', contentManagerCookie)
      .send({ title: 'Anything' })
      .expect(404);
  });

  it('POST /story-catalog/:id/image uploads a real hero file; uploading again replaces it; DELETE removes it', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Story with hero photo',
        categoryId,
        tiers: ['FOUNDING'],
        sections: [],
      })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(uploaded.body.heroImageUrl).toMatch(/^\/uploads\/stories\/.+\.jpg$/);
    const firstPath = join(process.cwd(), uploaded.body.heroImageUrl.slice(1));
    await expect(fs.stat(firstPath)).resolves.toBeDefined();

    const replaced = await request(app.getHttpServer())
      .post(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_IMAGE)
      .expect(201);
    expect(replaced.body.heroImageUrl).not.toBe(uploaded.body.heroImageUrl);
    await expect(fs.stat(firstPath)).rejects.toThrow();

    const auditReplaced = await prisma.auditLog.findMany({
      where: { action: 'story.image_replaced', targetId: created.body.id },
    });
    expect(auditReplaced).toHaveLength(1);

    const secondPath = join(process.cwd(), replaced.body.heroImageUrl.slice(1));
    await request(app.getHttpServer())
      .delete(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .expect(200);
    await expect(fs.stat(secondPath)).rejects.toThrow();

    const finalRow = await prisma.story.findUnique({
      where: { id: created.body.id },
    });
    expect(finalRow!.heroImageUrl).toBeNull();
  });

  // Regression test for the 2026-09-09 stored-XSS finding — same fileFilter
  // util, same fix, exercised on both upload endpoints (hero + section).
  it('rejects an SVG upload (stored-XSS vector) with 400 on both the hero and section-image endpoints', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: `SVG Upload Test ${Date.now()}`,
        categoryId,
        tiers: ['FOUNDING'],
        sections: [],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/story-catalog/${created.body.id}/image`)
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/story-catalog/section-image')
      .set('Cookie', contentManagerCookie)
      .attach('file', FIXTURE_SVG, { contentType: 'image/svg+xml' })
      .expect(400);
  });

  it("GET /members/me/stories only returns PUBLISHED stories visible to the member's own tier", async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');

    const foundingOnlyStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Founding-only story',
        categoryId,
        tiers: ['FOUNDING'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);
    const annualOnlyStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Annual-only story',
        categoryId,
        tiers: ['ANNUAL'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);
    const draftFoundingStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Draft story',
        categoryId,
        tiers: ['FOUNDING'],
        status: 'DRAFT',
        sections: [],
      })
      .expect(201);

    const foundingCookie = await foundingMemberSession('published-check');
    const res = await request(app.getHttpServer())
      .get('/members/me/stories')
      .set('Cookie', foundingCookie)
      .expect(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(foundingOnlyStory.body.id);
    expect(ids).not.toContain(annualOnlyStory.body.id);
    expect(ids).not.toContain(draftFoundingStory.body.id);
  });

  it('a story visible to all tiers reaches a Newsletter member; a Founding-only story does not', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');

    const publicStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Club news, for everyone',
        categoryId,
        tiers: ['FOUNDING', 'ANNUAL', 'NEWSLETTER', 'MONGOLIA'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);
    const membersOnlyStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Members-only story',
        categoryId,
        tiers: ['FOUNDING', 'ANNUAL'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);

    const externalId = `stories-e2e-newsletter-${Date.now()}`;
    const newsletterMember = await members.findOrCreateFromIdentity({
      providerId: 'shopify',
      externalId,
      email: `${externalId}@example.com`,
    });

    const res = await request(app.getHttpServer())
      .get('/members/me/stories')
      .set('Cookie', sessionCookieFor(newsletterMember.id))
      .expect(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(publicStory.body.id);
    expect(ids).not.toContain(membersOnlyStory.body.id);
  });

  it("GET /members/me/stories/featured only returns PUBLISHED + featured stories visible to the member's own tier", async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');

    const featuredStory = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Featured on the homepage',
        categoryId,
        tiers: ['FOUNDING'],
        status: 'PUBLISHED',
        featured: true,
        sections: [],
      })
      .expect(201);
    const publishedNotFeatured = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Published but not featured',
        categoryId,
        tiers: ['FOUNDING'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);
    const featuredButDraft = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Featured but still draft',
        categoryId,
        tiers: ['FOUNDING'],
        status: 'DRAFT',
        featured: true,
        sections: [],
      })
      .expect(201);

    const foundingCookie = await foundingMemberSession('featured-check');
    const res = await request(app.getHttpServer())
      .get('/members/me/stories/featured')
      .set('Cookie', foundingCookie)
      .expect(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(featuredStory.body.id);
    expect(ids).not.toContain(publishedNotFeatured.body.id);
    expect(ids).not.toContain(featuredButDraft.body.id);
  });

  // Designer Spotlight attribution (client go-ahead, 2026-09-15) — plain
  // string, not a foreign key (see schema.prisma's comment on
  // Story.designerName). Round-trips through create/update and reaches the
  // member-facing read like every other field. Category is now a real FK
  // (the seeded "Designer Spotlight" category), not a freeform string.
  it('designerName round-trips through create, update, and the member-facing read', async () => {
    const contentManagerCookie = await staffCookieFor('Content Manager');
    const spotlightCategory = await prisma.storyCategory.findFirstOrThrow({
      where: { name: 'Designer Spotlight' },
    });

    const created = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Designer Spotlight: Cansel',
        categoryId: spotlightCategory.id,
        designerName: 'Cansel',
        tiers: ['FOUNDING', 'ANNUAL'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);
    expect(created.body.designerName).toBe('Cansel');
    expect(created.body.category.name).toBe('Designer Spotlight');

    const noDesigner = await request(app.getHttpServer())
      .post('/story-catalog')
      .set('Cookie', contentManagerCookie)
      .send({
        title: 'Club news',
        categoryId,
        tiers: ['FOUNDING'],
        status: 'PUBLISHED',
        sections: [],
      })
      .expect(201);
    expect(noDesigner.body.designerName).toBeNull();

    const foundingCookie = await foundingMemberSession('designer-check');
    const res = await request(app.getHttpServer())
      .get('/members/me/stories')
      .set('Cookie', foundingCookie)
      .expect(200);
    const spotlight = res.body.find(
      (s: { id: string }) => s.id === created.body.id,
    );
    expect(spotlight.designerName).toBe('Cansel');

    const updated = await request(app.getHttpServer())
      .patch(`/story-catalog/${noDesigner.body.id}`)
      .set('Cookie', contentManagerCookie)
      .send({ designerName: 'Cansel' })
      .expect(200);
    expect(updated.body.designerName).toBe('Cansel');
  });
});
