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
import { Member } from '@prisma/client';

@Controller('members')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly dataSubjectRequests: DataSubjectRequestsService,
    private readonly wishlist: WishlistService,
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
