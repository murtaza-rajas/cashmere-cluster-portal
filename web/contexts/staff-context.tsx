"use client";

import { createContext, useContext } from "react";
import type { StaffUser } from "@/lib/staff-api";

const StaffContext = createContext<StaffUser | null>(null);

export function StaffProvider({ staff, children }: { staff: StaffUser; children: React.ReactNode }) {
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

/** Only valid inside (staff)/layout.tsx's subtree — that layout guarantees a staff user is loaded before rendering children. */
export function useStaff(): StaffUser {
  const staff = useContext(StaffContext);
  if (!staff) {
    throw new Error("useStaff() called outside the (staff) route group — no staff user in context");
  }
  return staff;
}

/** Super Administrator bypasses any role check server-side too (see StaffService.hasAnyRole) — mirrored here so the UI never offers an action the API would reject. */
export function staffHasAnyRole(staff: StaffUser, allowed: string[]): boolean {
  return staff.roles.includes("Super Administrator") || staff.roles.some((r) => allowed.includes(r));
}
