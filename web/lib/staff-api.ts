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

export interface StaffDataSubjectRequest {
  id: string;
  type: "ACCESS" | "EXPORT" | "DELETION";
  status: "PENDING" | "COMPLETED";
  requestedAt: string;
  completedAt: string | null;
  member: { id: string; email: string; firstName: string | null; lastName: string | null };
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
