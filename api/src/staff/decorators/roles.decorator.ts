import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to staff holding at least one of the named roles
 * (from the 9 fixed presets seeded in prisma/seed.ts — see PROJECT_TRACKER.md
 * Section 3, "fixed roles as configurable presets"). Super Administrator always
 * passes, regardless of what's listed here — see StaffService.hasAnyRole.
 *
 * Usage: @Roles('Club Manager', 'Member Support')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
