import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { StaffUser } from '@prisma/client';

// Attaches the authenticated staff user as req.staffUser (never req.user) — kept
// deliberately distinct from the member session (see auth/guards/jwt-auth.guard.ts)
// so the two can never be confused with each other, even though both are JWT-in-cookie.
@Injectable()
export class StaffAuthGuard extends AuthGuard('staff-jwt') {
  handleRequest<TUser = StaffUser>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Invalid or expired staff session');
    }
    const request = context.switchToHttp().getRequest<Request>();
    request.staffUser = user as unknown as StaffUser;
    return user;
  }
}
