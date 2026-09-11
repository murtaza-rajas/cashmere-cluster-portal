import type { StaffUser } from '@prisma/client';

// What StaffJwtStrategy.validate() actually returns (via StaffService.findById) —
// the raw StaffUser row plus a denormalized `roles` array, not just StaffUser
// itself. The type here was out of sync with that until 2026-09-11 (nothing had
// read req.staffUser.roles directly before region-scoped roles needed it — every
// prior role check went through RolesGuard's own DB query instead).
type AuthenticatedStaffUser = StaffUser & { roles: string[] };

declare global {
  namespace Express {
    interface Request {
      // Set by StaffAuthGuard.handleRequest — deliberately never req.user, so it
      // can never be confused with an authenticated Member (see auth/guards/jwt-auth.guard.ts).
      staffUser?: AuthenticatedStaffUser;
    }
  }
}
