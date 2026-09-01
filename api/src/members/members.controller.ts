import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembersService } from './members.service';
import { Member } from '@prisma/client';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

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
}
