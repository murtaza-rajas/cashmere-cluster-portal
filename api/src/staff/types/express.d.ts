import type { StaffUser } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      // Set by StaffAuthGuard.handleRequest — deliberately never req.user, so it
      // can never be confused with an authenticated Member (see auth/guards/jwt-auth.guard.ts).
      staffUser?: StaffUser;
    }
  }
}
