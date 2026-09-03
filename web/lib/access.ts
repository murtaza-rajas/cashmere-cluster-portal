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
  | "helpSupport";

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
};

const ACCESS_MATRIX: Record<Tier, Record<PortalArea, AccessLevel>> = {
  FOUNDING: FULL_ACCESS,
  ANNUAL: FULL_ACCESS,
  NEWSLETTER: NEWSLETTER_ACCESS,
  // Not covered by the PDF (predates the Mongolia Community decision, Section 3a
  // of PROJECT_TRACKER.md) — defaulting to the same restricted set as NEWSLETTER
  // until the client confirms Mongolia-specific access rules. Deliberately NOT
  // defaulted to FULL_ACCESS: per the Mongolia review, a Mongolia membership must
  // never be assumed to carry the same benefits as the international paid tiers.
  MONGOLIA: NEWSLETTER_ACCESS,
};

export function getAccessLevel(tier: Tier, area: PortalArea): AccessLevel {
  return ACCESS_MATRIX[tier][area];
}
