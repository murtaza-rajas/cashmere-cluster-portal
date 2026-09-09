import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { MembersService } from './members.service';
import { DataSubjectRequestsService } from '../data-subject-requests/data-subject-requests.service';
import { WishlistService } from '../wishlist/wishlist.service';
import { AddWishlistItemDto } from '../wishlist/dto/add-wishlist-item.dto';
import { BenefitsService } from '../benefits/benefits.service';
import { SiteImagesService } from '../site-images/site-images.service';
import { EventsService } from '../events/events.service';
import { CareGuidesService } from '../care-guides/care-guides.service';
import { DesignsService } from '../designs/designs.service';
import { Member, BenefitType } from '@prisma/client';

@Controller('members')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly dataSubjectRequests: DataSubjectRequestsService,
    private readonly wishlist: WishlistService,
    private readonly benefits: BenefitsService,
    private readonly siteImages: SiteImagesService,
    private readonly events: EventsService,
    private readonly careGuides: CareGuidesService,
    private readonly designs: DesignsService,
  ) {}

  // What the frontend calls on load to check login state — 401 if no/invalid
  // session cookie, otherwise the current member. JwtStrategy.validate() already
  // returns the Member row, which passport attaches to req.user by default.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/orders')
  orders(@Req() req: Request) {
    return this.members.findOrdersForMember((req.user as Member).id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/collection')
  collection(@Req() req: Request) {
    return this.members.findCollectionForMember((req.user as Member).id);
  }

  // Self-service GDPR access requests — see DataSubjectRequestsService.
  // createFromMember for why this is scoped to ACCESS only, not deletion.
  @UseGuards(JwtAuthGuard)
  @Get('me/data-requests')
  dataRequests(@Req() req: Request) {
    return this.dataSubjectRequests.findForMember((req.user as Member).id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/data-requests')
  createDataRequest(@Req() req: Request) {
    return this.dataSubjectRequests.createFromMember((req.user as Member).id);
  }

  // Self-service Wishlist — see WishlistService for the (memberId, shopifyProductId)
  // idempotency behavior. This POST is what the eventual CashmereHouse.com "Add to
  // Wishlist" integration would call once its own auth design is resolved (see
  // PROJECT_TRACKER.md Section 3c) — not fabricated, just built ahead of that piece.
  @UseGuards(JwtAuthGuard)
  @Get('me/wishlist')
  getWishlist(@Req() req: Request) {
    return this.wishlist.findForMember((req.user as Member).id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/wishlist')
  addWishlistItem(@Req() req: Request, @Body() dto: AddWishlistItemDto) {
    return this.wishlist.addItem((req.user as Member).id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/wishlist/:id')
  removeWishlistItem(@Req() req: Request, @Param('id') id: string) {
    return this.wishlist.removeItem((req.user as Member).id, id);
  }

  // My Benefits / Member Offers — real, staff-curated content (see BenefitsService),
  // replacing what used to be hardcoded copy on both pages. Filtered to the
  // member's own tier and active rows only.
  @UseGuards(JwtAuthGuard)
  @Get('me/benefits')
  myBenefits(@Req() req: Request) {
    return this.benefits.findForMember(
      (req.user as Member).membershipTier,
      BenefitType.BENEFIT,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/offers')
  myOffers(@Req() req: Request) {
    return this.benefits.findForMember(
      (req.user as Member).membershipTier,
      BenefitType.OFFER,
    );
  }

  // Tier-specific hero photos (see SiteImagesService) — a map of slot name to
  // URL for just the slots staff have configured for this member's tier. The
  // frontend falls back to its bundled static default for any slot missing here.
  @UseGuards(JwtAuthGuard)
  @Get('me/site-images')
  mySiteImages(@Req() req: Request) {
    return this.siteImages.findForMember((req.user as Member).membershipTier);
  }

  // Invitations & Events — real, staff-curated events (see EventsService),
  // replacing the two hardcoded dummy events. Filtered to the member's own
  // tier and active rows only.
  @UseGuards(JwtAuthGuard)
  @Get('me/events')
  myEvents(@Req() req: Request) {
    return this.events.findForMember((req.user as Member).membershipTier);
  }

  // Care & Repair guide bodies — not tier-scoped (unlike the above), since
  // the page's existing preview/full split is already handled at the page
  // level via lib/access.ts, not per-guide.
  @UseGuards(JwtAuthGuard)
  @Get('me/care-guides')
  myCareGuides() {
    return this.careGuides.findAllForMember();
  }

  // Founders' Design Lab — international-only, tier-gated to Founding (full:
  // view/save/vote) and Annual (preview: view/save only). The service itself
  // enforces the real gate (returns [] / throws 403), matching this
  // project's "must be blocked even via direct URL" rule — this controller
  // doesn't duplicate that logic, just passes the member's real tier through.
  @UseGuards(JwtAuthGuard)
  @Get('me/designs')
  myDesigns(@Req() req: Request) {
    const member = req.user as Member;
    return this.designs.findForMember(member.id, member.membershipTier);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/designs/:id/favorite')
  favoriteDesign(@Param('id') id: string, @Req() req: Request) {
    const member = req.user as Member;
    return this.designs.addFavorite(id, member.id, member.membershipTier);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/designs/:id/favorite')
  unfavoriteDesign(@Param('id') id: string, @Req() req: Request) {
    return this.designs.removeFavorite(id, (req.user as Member).id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/designs/:id/vote')
  voteDesign(@Param('id') id: string, @Req() req: Request) {
    const member = req.user as Member;
    return this.designs.addVote(id, member.id, member.membershipTier);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/designs/:id/vote')
  unvoteDesign(@Param('id') id: string, @Req() req: Request) {
    return this.designs.removeVote(id, (req.user as Member).id);
  }

  // Members & Users admin (Milestone 5) — staff-facing directory/search.
  // Declared after every /members/me/* route above: both routes below share the
  // same path shape as those (/members/<segment>), and Nest/Express resolve
  // ambiguous routes in registration order, so the literal "me" routes must stay
  // registered first or a request for /members/me would incorrectly match
  // memberDetail's :id param instead.
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Club Manager', 'Member Support')
  @Get()
  findAllMembers(@Query('search') search?: string) {
    return this.members.findAllForStaff(search);
  }

  // Combined read-only snapshot (profile + orders + collection + wishlist) so
  // Member Support can look someone up in one call instead of four.
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles('Club Manager', 'Member Support')
  @Get(':id')
  async memberDetail(@Param('id') id: string) {
    const member = await this.members.findByIdForStaff(id);
    const [orders, collection, wishlistItems] = await Promise.all([
      this.members.findOrdersForMember(id),
      this.members.findCollectionForMember(id),
      this.wishlist.findForMember(id),
    ]);
    return { member, orders, collection, wishlist: wishlistItems };
  }
}
