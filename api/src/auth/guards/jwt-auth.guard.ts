import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Apply with @UseGuards(JwtAuthGuard) on any member-portal route (dashboard, profile,
// order history, etc). Staff/admin routes will get their own guard once RBAC
// (StaffRoleAssignment-based) is built in Milestone 2/5 — deliberately not reusing
// this one, since "logged-in member" and "authorized staff member" are different checks.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
