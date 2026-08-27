import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { StaffService } from '../staff.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Authorization only — pair with StaffAuthGuard (or whatever staff authentication
// is finalised in the Milestone 1 evaluation) so req.staffUser is already populated.
// This guard doesn't care how the staff member authenticated, only what role they hold —
// deliberately kept separate so the eventual staff identity provider swap doesn't
// touch authorization logic at all.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staffService: StaffService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no @Roles() on this route — StaffAuthGuard alone is enough
    }

    const request = context.switchToHttp().getRequest<Request>();
    const staffUser = request.staffUser;
    if (!staffUser) {
      throw new ForbiddenException('No staff session on request');
    }

    const allowed = await this.staffService.hasAnyRole(
      staffUser.id,
      requiredRoles,
    );
    if (!allowed) {
      throw new ForbiddenException(
        `Requires one of: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
