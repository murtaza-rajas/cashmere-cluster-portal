import { Controller, Get } from '@nestjs/common';
import { MembershipTier } from '@prisma/client';
import { StoriesService } from '../stories/stories.service';
import { HomepageUpdatesService } from '../homepage-updates/homepage-updates.service';

// Public, no login: the content shown on the homepage behind the sign-in panel
// (client request 2026-10-14 — "the live homepage, public content only").
// Exactly what a Newsletter member sees: story teasers (member-only ones come
// back locked, never with their text) and the newsletter-level CLC Update
// banner. Nothing personal or member-only.
@Controller('showcase')
export class ShowcaseController {
  constructor(
    private readonly stories: StoriesService,
    private readonly homepageUpdates: HomepageUpdatesService,
  ) {}

  @Get('stories')
  publicStories() {
    return this.stories.findPreviewsForMember(MembershipTier.NEWSLETTER);
  }

  @Get('homepage-update')
  homepageUpdate() {
    return this.homepageUpdates.findCurrentForMember(MembershipTier.NEWSLETTER);
  }
}
