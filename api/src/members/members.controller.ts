import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembersService } from './members.service';
import { DataSubjectRequestsService } from '../data-subject-requests/data-subject-requests.service';
import { Member } from '@prisma/client';

@Controller('members')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly dataSubjectRequests: DataSubjectRequestsService,
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
}
