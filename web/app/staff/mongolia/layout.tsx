"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";

// Coarse "can reach the Mongolia section at all" gate — deliberately the
// union of every role any Mongolia sub-page needs, not just Content
// Manager. Events and Offers reuse the exact same international admin
// logic (client's own instruction, 2026-09-11) — which means the exact
// same role gates too (Event Manager, Club Manager), not a watered-down
// Content-Manager-only version. Each sub-page still enforces its own
// precise role below, matching its international counterpart exactly;
// this layout only stops someone with none of these roles at all.
// Mongolia Editor (added the same day — the first regional/community
// role, see api/src/staff/region-scope.util.ts) can reach every child, but
// the backend confines what they can actually see/touch to Mongolia-only
// rows — the frontend gate here is deliberately coarse, real enforcement
// lives server-side, same discipline as every other role in this app.
const MONGOLIA_SECTION_ROLES = ["Content Manager", "Event Manager", "Club Manager", "Member Support", "Mongolia Editor"];

export default function MongoliaSectionLayout({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, MONGOLIA_SECTION_ROLES);

  useEffect(() => {
    if (!canManage) {
      router.replace("/staff");
    }
  }, [canManage, router]);

  if (!canManage) return null;

  return <div className="flex w-full flex-col gap-6">{children}</div>;
}
