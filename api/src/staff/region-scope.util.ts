import { Region } from '@prisma/client';

// Regional/community staff roles — client's explicit instruction
// (2026-09-11): "structure the Mongolia-specific functionality as much as
// possible as a regional/community layer rather than hardcoding Mongolia
// throughout the system... in the longer term we may want to use the same
// structure for other countries, regions or communities." Mongolia Editor
// is the first entry; a future "Nepal Editor" or similar is one more line
// here (plus a new Region enum value) — not a rewrite of the services
// below, which only ever deal in `Region`, never a role name.
const REGION_SCOPED_ROLES: Record<string, Region> = {
  'Mongolia Editor': 'MONGOLIA',
};

// Returns the single region a staffer is confined to for a given action,
// or null if they have full (region-unscoped) access. Super Administrator
// and any role in `fullAccessRoles` (the domain's normal "can manage
// everything" role — Event Manager for events, Club Manager for
// benefits/members, etc.) always grant full access, even alongside a
// regional role — the broader grant wins, it never narrows.
//
// The caller is assumed to already be past a route-level @Roles() guard
// that required at least one of fullAccessRoles or a REGION_SCOPED_ROLES
// key, so "no match at all" can't happen in practice — this only decides
// full vs. scoped, not allowed vs. denied.
export function getScopedRegion(
  staffRoles: string[],
  fullAccessRoles: string[],
): Region | null {
  if (staffRoles.includes('Super Administrator')) return null;
  if (staffRoles.some((r) => fullAccessRoles.includes(r))) return null;
  for (const role of staffRoles) {
    const region = REGION_SCOPED_ROLES[role];
    if (region) return region;
  }
  return null;
}
