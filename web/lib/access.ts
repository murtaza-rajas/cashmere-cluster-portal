import type { Member } from "./api";

// Mirrors cashmere-lovers-club-access-administration-model PDF, Section 4
// ("Customer portal access matrix") and Section 5 ("Navigation menus") — the
// client's own Phase 1 spec, not an invented scheme. Kept as one shared table so
// every portal page (built now or later, per Milestone 5) checks access the same
// way, rather than each page reinventing its own rule.
//
// "full" — unrestricted. "preview" — a public/limited version only (e.g. public
// previews, public stories) — the page itself renders, but with restricted-content
// hidden, never fetched/exposed. "none" — no access to real content; a page in
// this state must redirect away rather than render anything, per the PDF's own
// requirement: "Restricted pages must be blocked even if a user attempts to open
// the URL directly. Hiding a navigation item is not sufficient access control."
export type AccessLevel = "full" | "preview" | "none";

export type PortalArea =
  | "dashboard"
  | "memberOffers"
  | "exclusiveCollections"
  | "myOrders"
  | "myCollection"
  | "wishlist"
  | "invitationsEvents"
  | "storiesKnowledge"
  | "careRepair"
  | "myBenefits"
  | "profile"
  | "settings"
  | "helpSupport"
  | "designLab";

type Tier = Member["membershipTier"];

// FOUNDING and ANNUAL are identical for access purposes in the PDF's matrix — the
// difference between them is the *content* shown (e.g. "Founding benefits" vs
// "Annual benefits"), not which areas are reachable at all.
const FULL_ACCESS: Record<PortalArea, AccessLevel> = {
  dashboard: "full",
  memberOffers: "full",
  exclusiveCollections: "full",
  myOrders: "full",
  myCollection: "full",
  wishlist: "full",
  invitationsEvents: "full",
  storiesKnowledge: "full",
  careRepair: "full",
  myBenefits: "full",
  profile: "full",
  settings: "full",
  helpSupport: "full",
  designLab: "full",
};

// The one area where Founding and Annual genuinely differ — confirmed
// directly from the three real tier-homepage mockups (client email
// 2026-09-07/08, see schema.prisma's Design model comment), not assumed
// from FOUNDING and ANNUAL's usual "identical for access purposes" rule.
// Annual gets a homepage teaser leading to a preview (view + save, no vote,
// no persistent sidebar nav item); Founding gets the full experience.
const ANNUAL_ACCESS: Record<PortalArea, AccessLevel> = {
  ...FULL_ACCESS,
  designLab: "preview",
};

const NEWSLETTER_ACCESS: Record<PortalArea, AccessLevel> = {
  dashboard: "preview", // "Simple home page", not the full dashboard
  memberOffers: "none",
  exclusiveCollections: "preview", // "Public previews only"
  myOrders: "full", // "If connected to a Shopify customer" — the page itself is reachable; existing empty state already handles "nothing to show" honestly, so no separate gate needed here
  myCollection: "none",
  wishlist: "full",
  invitationsEvents: "preview", // "Public events only"
  storiesKnowledge: "preview", // "Public stories only"
  careRepair: "preview", // "Public guides only"
  myBenefits: "preview", // "Invitation to become a member" — not the real benefits list
  profile: "full",
  settings: "preview", // "Newsletter settings" only, not full account settings
  helpSupport: "full", // "General customer support" — lower-priority, but not blocked
  designLab: "none", // International-only feature (client's own written scope) — Mongolia inherits this same "none" below, deliberately, not because Mongolia is otherwise like Newsletter
};

const ACCESS_MATRIX: Record<Tier, Record<PortalArea, AccessLevel>> = {
  FOUNDING: FULL_ACCESS,
  ANNUAL: ANNUAL_ACCESS,
  NEWSLETTER: NEWSLETTER_ACCESS,
  // Not covered by the PDF (predates the Mongolia Community decision, Section 3a
  // of PROJECT_TRACKER.md). Client-confirmed 2026-09-07: Mongolia Founding
  // Member is a real, distinct, more-privileged tier ("access to additional
  // areas and opportunities for active participation, including voting and
  // other member-only content") — this is now KNOWN incomplete, not merely
  // unconfirmed, but the specific per-area matrix (which of the international
  // PDF's 13 areas apply to Mongolia at all, e.g. Care & Repair/My Benefits/
  // Member Offers as currently defined are international-specific concepts)
  // hasn't been given yet, so this still defaults to the restricted NEWSLETTER
  // set rather than guessing one. Deliberately NOT defaulted to FULL_ACCESS
  // either: a Mongolia membership must never be assumed to carry the same
  // benefits as the international paid tiers just because it's now confirmed
  // as "more privileged than Mongolia Newsletter" in the abstract.
  MONGOLIA: NEWSLETTER_ACCESS,
};

export function getAccessLevel(tier: Tier, area: PortalArea): AccessLevel {
  return ACCESS_MATRIX[tier][area];
}
