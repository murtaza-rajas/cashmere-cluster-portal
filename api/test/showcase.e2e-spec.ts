import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.util';

// Public homepage content behind the sign-in panel: no login, and only what a
// Newsletter member would see.
describe('Showcase (public homepage content) (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves story teasers without login; member-only stories come back locked with no text', async () => {
    const category = await prisma.storyCategory.findFirstOrThrow();
    const secret = `showcase-secret-${Date.now()}`;
    const membersOnly = await prisma.story.create({
      data: {
        title: `Showcase members-only ${Date.now()}`,
        categoryId: category.id,
        tiers: ['ANNUAL', 'FOUNDING'],
        status: 'PUBLISHED',
        sections: { create: [{ order: 0, type: 'TEXT', text: 'Intro.' }, { order: 1, type: 'TEXT', text: secret }] },
      },
    });
    const draft = await prisma.story.create({
      data: { title: `Showcase draft ${Date.now()}`, categoryId: category.id, tiers: ['NEWSLETTER'], status: 'DRAFT' },
    });

    const res = await request(app.getHttpServer()).get('/showcase/stories').expect(200);
    const found = res.body.find((s: { id: string }) => s.id === membersOnly.id);
    expect(found.locked).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(secret);
    expect(res.body.some((s: { id: string }) => s.id === draft.id)).toBe(false);
  });

  it('serves only a banner meant for newsletter members', async () => {
    const paidOnly = await prisma.homepageUpdate.create({
      data: { title: `Showcase paid-only ${Date.now()}`, summary: 's', tiers: ['FOUNDING'], displayDate: new Date('2099-01-01') },
    });
    const res = await request(app.getHttpServer()).get('/showcase/homepage-update').expect(200);
    expect(res.body?.id).not.toBe(paidOnly.id);
    await prisma.homepageUpdate.delete({ where: { id: paidOnly.id } });
  });
});
