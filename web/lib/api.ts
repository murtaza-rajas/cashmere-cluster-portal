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

export interface DataSubjectRequest {
  id: string;
  type: "ACCESS" | "EXPORT" | "DELETION";
  status: "PENDING" | "COMPLETED";
  requestedAt: string;
  completedAt: string | null;
}

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
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

export function membershipTierLabel(tier: Member["membershipTier"], isFoundingMember: boolean): string {
  if (isFoundingMember) return "Founding Member";
  if (tier === "ANNUAL") return "Annual Member";
  if (tier === "MONGOLIA") return "Mongolia Community Member";
  return "Newsletter Subscriber";
}
