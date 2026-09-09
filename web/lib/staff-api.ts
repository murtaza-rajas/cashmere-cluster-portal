import { apiFetch } from "./api";
import type { Member, MemberOrder, CollectionItem, WishlistItem } from "./api";

// Separate from lib/api.ts's member-facing types/fetchers on purpose — staff
// auth is a completely separate session (clc_staff_session cookie, different
// JWT secret, see api/src/staff/strategies/staff-jwt.strategy.ts), never to be
// confused with a member session.

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

// The shape GET /members actually selects (members.service.ts's findAllForStaff)
// — a subset of the full Member fields, not the complete row the detail view
// below gets, so this is its own type rather than reusing `Member` as-is.
export interface MemberSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  membershipTier: Member["membershipTier"];
  membershipStatus: Member["membershipStatus"];
  region: Member["region"];
  language: Member["language"];
  isFoundingMember: boolean;
  createdAt: string;
}

export interface MemberDetail {
  member: Member;
  orders: MemberOrder[];
  collection: CollectionItem[];
  wishlist: WishlistItem[];
}

// Full staff-facing shape of a Benefit row — includes tiers/active/sortOrder,
// which the member-facing Benefit type (lib/api.ts) deliberately omits since
// members only ever see the filtered, already-scoped result.
export interface StaffBenefit {
  id: string;
  type: "BENEFIT" | "OFFER";
  tiers: ("FOUNDING" | "ANNUAL" | "MONGOLIA" | "NEWSLETTER")[];
  icon: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

export type SiteImageSlot = "DASHBOARD_HERO" | "CARE_REPAIR_HERO" | "SIDEBAR_HELP";
export type MembershipTierValue = "FOUNDING" | "ANNUAL" | "MONGOLIA" | "NEWSLETTER";

export interface StaffSiteImage {
  id: string;
  slot: SiteImageSlot;
  tier: MembershipTierValue;
  url: string;
  uploadedAt: string;
}

export interface StaffDataSubjectRequest {
  id: string;
  type: "ACCESS" | "EXPORT" | "DELETION";
  status: "PENDING" | "COMPLETED";
  requestedAt: string;
  completedAt: string | null;
  member: { id: string; email: string; firstName: string | null; lastName: string | null };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetMemberId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
  actorStaffUser: { id: string; name: string; email: string } | null;
  targetMember: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  action?: string;
  targetType?: string;
  actorStaffUserId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(`/audit-log${query}`);
  if (!res.ok) throw new Error(`Unexpected response fetching audit log: ${res.status}`);
  return res.json();
}

export async function fetchAuditLogActions(): Promise<string[]> {
  const res = await apiFetch("/audit-log/actions");
  if (!res.ok) throw new Error(`Unexpected response fetching audit log actions: ${res.status}`);
  return res.json();
}

export async function fetchCurrentStaff(): Promise<StaffUser | null> {
  const res = await apiFetch("/staff/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Unexpected response checking staff session: ${res.status}`);
  return res.json();
}

export async function fetchStaffDirectory(): Promise<StaffUser[]> {
  const res = await apiFetch("/staff");
  if (!res.ok) throw new Error(`Unexpected response fetching staff directory: ${res.status}`);
  return res.json();
}

export async function createStaffUser(params: { email: string; name: string }): Promise<StaffUser> {
  const res = await apiFetch("/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response creating staff user: ${res.status}`);
  }
  return res.json();
}

export async function fetchRoles(): Promise<RoleOption[]> {
  const res = await apiFetch("/staff/roles");
  if (!res.ok) throw new Error(`Unexpected response fetching roles: ${res.status}`);
  return res.json();
}

export async function grantRole(staffUserId: string, roleName: string): Promise<void> {
  const res = await apiFetch(`/staff/${staffUserId}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleName }),
  });
  if (!res.ok) throw new Error(`Unexpected response granting role: ${res.status}`);
}

export async function revokeRole(staffUserId: string, roleName: string): Promise<void> {
  const res = await apiFetch(`/staff/${staffUserId}/roles/${encodeURIComponent(roleName)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Unexpected response revoking role: ${res.status}`);
}

export async function fetchMembers(search?: string): Promise<MemberSummary[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await apiFetch(`/members${query}`);
  if (!res.ok) throw new Error(`Unexpected response fetching members: ${res.status}`);
  return res.json();
}

export async function fetchMemberDetail(id: string): Promise<MemberDetail> {
  const res = await apiFetch(`/members/${id}`);
  if (res.status === 404) throw new Error("Member not found");
  if (!res.ok) throw new Error(`Unexpected response fetching member detail: ${res.status}`);
  return res.json();
}

export async function fetchBenefitCatalog(type?: "BENEFIT" | "OFFER"): Promise<StaffBenefit[]> {
  const query = type ? `?type=${type}` : "";
  const res = await apiFetch(`/benefit-catalog${query}`);
  if (!res.ok) throw new Error(`Unexpected response fetching benefit catalog: ${res.status}`);
  return res.json();
}

export interface BenefitInput {
  type: "BENEFIT" | "OFFER";
  tiers: ("FOUNDING" | "ANNUAL" | "MONGOLIA" | "NEWSLETTER")[];
  icon?: string;
  title: string;
  description?: string;
  sortOrder?: number;
  active?: boolean;
}

export async function createBenefit(dto: BenefitInput): Promise<StaffBenefit> {
  const res = await apiFetch("/benefit-catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response creating benefit: ${res.status}`);
  }
  return res.json();
}

export async function updateBenefit(id: string, dto: Partial<BenefitInput>): Promise<StaffBenefit> {
  const res = await apiFetch(`/benefit-catalog/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response updating benefit: ${res.status}`);
  }
  return res.json();
}

export async function deleteBenefit(id: string): Promise<void> {
  const res = await apiFetch(`/benefit-catalog/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response deleting benefit: ${res.status}`);
}

export async function fetchSiteImages(): Promise<StaffSiteImage[]> {
  const res = await apiFetch("/site-image-catalog");
  if (!res.ok) throw new Error(`Unexpected response fetching site images: ${res.status}`);
  return res.json();
}

export async function uploadSiteImage(
  slot: SiteImageSlot,
  tier: MembershipTierValue,
  file: File,
): Promise<StaffSiteImage> {
  const formData = new FormData();
  formData.append("file", file);
  // No Content-Type header here — the browser sets the correct multipart
  // boundary itself when the body is a FormData; setting it manually breaks that.
  const res = await apiFetch(`/site-image-catalog/${slot}/${tier}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response uploading image: ${res.status}`);
  }
  return res.json();
}

export async function deleteSiteImage(slot: SiteImageSlot, tier: MembershipTierValue): Promise<void> {
  const res = await apiFetch(`/site-image-catalog/${slot}/${tier}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response removing image: ${res.status}`);
}

export interface StaffEvent {
  id: string;
  title: string;
  description: string | null;
  locationType: "IN_PERSON" | "ONLINE";
  location: string | null;
  startsAt: string | null;
  registrationUrl: string | null;
  imageUrl: string | null;
  tiers: MembershipTierValue[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface EventInput {
  title: string;
  description?: string;
  locationType: "IN_PERSON" | "ONLINE";
  location?: string;
  startsAt?: string;
  registrationUrl?: string;
  tiers: MembershipTierValue[];
  sortOrder?: number;
  active?: boolean;
}

export async function fetchEventCatalog(): Promise<StaffEvent[]> {
  const res = await apiFetch("/event-catalog");
  if (!res.ok) throw new Error(`Unexpected response fetching events: ${res.status}`);
  return res.json();
}

export async function createEvent(dto: EventInput): Promise<StaffEvent> {
  const res = await apiFetch("/event-catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response creating event: ${res.status}`);
  }
  return res.json();
}

export async function updateEvent(id: string, dto: Partial<EventInput>): Promise<StaffEvent> {
  const res = await apiFetch(`/event-catalog/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response updating event: ${res.status}`);
  }
  return res.json();
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await apiFetch(`/event-catalog/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response deleting event: ${res.status}`);
}

export async function uploadEventImage(id: string, file: File): Promise<StaffEvent> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`/event-catalog/${id}/image`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Unexpected response uploading event image: ${res.status}`);
  }
  return res.json();
}

export async function deleteEventImage(id: string): Promise<void> {
  const res = await apiFetch(`/event-catalog/${id}/image`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unexpected response removing event image: ${res.status}`);
}

export async function fetchPendingDataRequests(): Promise<StaffDataSubjectRequest[]> {
  const res = await apiFetch("/data-subject-requests/pending");
  if (!res.ok) throw new Error(`Unexpected response fetching pending requests: ${res.status}`);
  return res.json();
}

export async function completeDataRequest(id: string, reason?: string): Promise<StaffDataSubjectRequest> {
  const res = await apiFetch(`/data-subject-requests/${id}/complete`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  if (!res.ok) throw new Error(`Unexpected response completing request: ${res.status}`);
  return res.json();
}
