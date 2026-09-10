export const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface Member {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  membershipTier: "FOUNDING" | "ANNUAL" | "MONGOLIA" | "NEWSLETTER";
  membershipStatus: "ACTIVE" | "EXPIRED" | "CANCELLED";
  region: "INTERNATIONAL" | "MONGOLIA";
  language: "ENGLISH" | "MONGOLIAN";
  isFoundingMember: boolean;
  termLengthYears: number | null;
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  createdAt: string;
}

export interface MemberOrder {
  id: string;
  shopifyOrderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  status: string;
  orderDate: string;
}

export interface CollectionItem {
  productId: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  price: string;
  orderNumber: string;
  orderDate: string;
}

export interface WishlistItem {
  id: string;
  shopifyProductId: string;
  title: string;
  variantTitle: string | null;
  price: string | null;
  addedAt: string;
}

export interface DataSubjectRequest {
  id: string;
  type: "ACCESS" | "EXPORT" | "DELETION";
  status: "PENDING" | "COMPLETED";
  requestedAt: string;
  completedAt: string | null;
}

// A single row shown on My Benefits (type BENEFIT) or Member Offers (type
// OFFER) — see api/prisma/schema.prisma's Benefit model comment. The member-
// facing fetchers below already filter to the member's own tier and active
// rows only (server-side), so nothing here needs the `tiers`/`active` fields.
export interface Benefit {
  id: string;
  type: "BENEFIT" | "OFFER";
  icon: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      // Harmless outside ngrok (real deployments ignore it): a free ngrok tunnel blocks
      // fetch/XHR requests with a browser-warning interstitial unless this is present —
      // only top-level page navigations get past it without the header.
      "ngrok-skip-browser-warning": "true",
      ...init?.headers,
    },
  });
}

export async function fetchCurrentMember(): Promise<Member | null> {
  const res = await apiFetch("/members/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Unexpected response checking session: ${res.status}`);
  return res.json();
}

export async function fetchMemberOrders(): Promise<MemberOrder[]> {
  const res = await apiFetch("/members/me/orders");
  if (!res.ok) throw new Error(`Unexpected response fetching orders: ${res.status}`);
  return res.json();
}

export async function fetchMemberCollection(): Promise<CollectionItem[]> {
  const res = await apiFetch("/members/me/collection");
  if (!res.ok) throw new Error(`Unexpected response fetching collection: ${res.status}`);
  return res.json();
}

export async function fetchMyBenefits(): Promise<Benefit[]> {
  const res = await apiFetch("/members/me/benefits");
  if (!res.ok) throw new Error(`Unexpected response fetching benefits: ${res.status}`);
  return res.json();
}

export async function fetchMyOffers(): Promise<Benefit[]> {
  const res = await apiFetch("/members/me/offers");
  if (!res.ok) throw new Error(`Unexpected response fetching offers: ${res.status}`);
  return res.json();
}

// Slot name -> URL, only for slots staff have actually uploaded an image for
// this member's own tier. Callers should fall back to their bundled static
// default for any slot missing here — nothing breaks before staff upload
// anything, or for a slot nobody's gotten to yet.
export type SiteImages = Partial<Record<"DASHBOARD_HERO" | "CARE_REPAIR_HERO" | "SIDEBAR_HELP", string>>;

export async function fetchMySiteImages(): Promise<SiteImages> {
  const res = await apiFetch("/members/me/site-images");
  if (!res.ok) throw new Error(`Unexpected response fetching site images: ${res.status}`);
  return res.json();
}

// A single event as shown to a member — already filtered server-side to
// active rows visible to the member's own tier, soonest first.
export interface MemberEvent {
  id: string;
  title: string;
  description: string | null;
  locationType: "IN_PERSON" | "ONLINE";
  location: string | null;
  startsAt: string | null;
  registrationUrl: string | null;
  imageUrl: string | null;
}

export async function fetchMyEvents(): Promise<MemberEvent[]> {
  const res = await apiFetch("/members/me/events");
  if (!res.ok) throw new Error(`Unexpected response fetching events: ${res.status}`);
  return res.json();
}

export interface CareGuide {
  topic: "WASHING" | "STORAGE" | "PILLING" | "REPAIRS" | "LONGEVITY";
  body: string | null;
}

export async function fetchMyCareGuides(): Promise<CareGuide[]> {
  const res = await apiFetch("/members/me/care-guides");
  if (!res.ok) throw new Error(`Unexpected response fetching care guides: ${res.status}`);
  return res.json();
}

// Founders' Design Lab — real favorite/vote counts and this member's own
// favorited/voted state on each design. `canVote` is the server's own
// tier-gating decision (Founding only) — the frontend just reads it rather
// than re-deriving the rule, so there's one source of truth for who can vote.
export interface MemberDesign {
  id: string;
  title: string;
  description: string | null;
  round: string | null;
  status: "CURRENT" | "SELECTED_FOR_PRODUCTION" | "PAST_ROUND";
  tags: string[];
  heroImageUrl: string | null;
  swatchImageUrl: string | null;
  sketchImageUrl: string | null;
  favoriteCount: number;
  voteCount: number;
  isFavorited: boolean;
  isVoted: boolean;
  canVote: boolean;
}

export async function fetchMyDesigns(): Promise<MemberDesign[]> {
  const res = await apiFetch("/members/me/designs");
  if (!res.ok) throw new Error(`Unexpected response fetching designs: ${res.status}`);
  return res.json();
}

export async function favoriteDesign(id: string): Promise<void> {
  const res = await apiFetch(`/members/me/designs/${id}/favorite`, { method: "POST" });
  if (!res.ok) throw new Error(`Unexpected response favoriting design: ${res.status}`);
}

export async function unfavoriteDesign(id: string): Promise<void> {
  const res = await apiFetch(`/members/me/designs/${id}/favorite`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response unfavoriting design: ${res.status}`);
}

export async function voteDesign(id: string): Promise<void> {
  const res = await apiFetch(`/members/me/designs/${id}/vote`, { method: "POST" });
  if (!res.ok) throw new Error(`Unexpected response voting for design: ${res.status}`);
}

export async function unvoteDesign(id: string): Promise<void> {
  const res = await apiFetch(`/members/me/designs/${id}/vote`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response removing vote: ${res.status}`);
}

export async function fetchWishlist(): Promise<WishlistItem[]> {
  const res = await apiFetch("/members/me/wishlist");
  if (!res.ok) throw new Error(`Unexpected response fetching wishlist: ${res.status}`);
  return res.json();
}

export async function removeWishlistItem(id: string): Promise<void> {
  const res = await apiFetch(`/members/me/wishlist/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response removing wishlist item: ${res.status}`);
}

export async function fetchMemberDataRequests(): Promise<DataSubjectRequest[]> {
  const res = await apiFetch("/members/me/data-requests");
  if (!res.ok) throw new Error(`Unexpected response fetching data requests: ${res.status}`);
  return res.json();
}

export async function requestMemberData(): Promise<DataSubjectRequest> {
  const res = await apiFetch("/members/me/data-requests", { method: "POST" });
  if (!res.ok) throw new Error(`Unexpected response creating data request: ${res.status}`);
  return res.json();
}

/** e.g. "March 2026" — matches the "Member since" format in the client's mockup. */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Human-readable member ID (e.g. "CLUB-4F2A91") derived from the database UUID.
 * NOT the client's eventual sequential numbering scheme (e.g. "CLUB-00187" in the
 * mockup) — that needs a real counter, which doesn't exist yet. This is a stable,
 * good-enough placeholder so the UI isn't showing a raw UUID in the meantime.
 */
export function formatMemberId(id: string): string {
  return `CLUB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

// Mongolia checked first, deliberately — client-confirmed 2026-09-07: Mongolia
// has its own two levels ("Mongolia Newsletter" / "Mongolia Founding Member"),
// entirely separate from the international Founding Member tier. `region`
// takes priority over `isFoundingMember` so a Mongolia member can never be
// mislabeled with the plain international "Founding Member" string, even if
// `isFoundingMember` is ever true for one (not expected today, but this
// function shouldn't depend on that never happening).
export function membershipTierLabel(
  tier: Member["membershipTier"],
  isFoundingMember: boolean,
  region: Member["region"],
): string {
  if (region === "MONGOLIA") {
    return tier === "MONGOLIA" ? "Mongolia Founding Member" : "Mongolia Newsletter";
  }
  if (isFoundingMember) return "Founding Member";
  if (tier === "ANNUAL") return "Annual Member";
  return "Newsletter Subscriber";
}

// Cashmere Lovers Club Mongolia — Stories. Server-side already restricts
// this to real Mongolia-region members (403 otherwise) and filters
// foundingOnly stories to Mongolia Founding Members only.
export interface MongoliaStory {
  id: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  heroImageUrl: string | null;
  foundingOnly: boolean;
}

export async function fetchMyMongoliaStories(): Promise<MongoliaStory[]> {
  const res = await apiFetch("/members/me/mongolia/stories");
  if (!res.ok) throw new Error(`Unexpected response fetching Mongolia stories: ${res.status}`);
  return res.json();
}

// Second Mongolia content type, same server-side gating as MongoliaStory.
export interface MongoliaProducer {
  id: string;
  name: string;
  craft: string | null;
  location: string | null;
  story: string | null;
  heroImageUrl: string | null;
  foundingOnly: boolean;
}

export async function fetchMyMongoliaProducers(): Promise<MongoliaProducer[]> {
  const res = await apiFetch("/members/me/mongolia/producers");
  if (!res.ok) throw new Error(`Unexpected response fetching Mongolia producers: ${res.status}`);
  return res.json();
}
