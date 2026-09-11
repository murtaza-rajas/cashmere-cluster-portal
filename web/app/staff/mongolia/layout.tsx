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
// this layout only stops someone with none of these roles at all. A
// narrower "Mongolia Editor" role (scoped only to Mongolia areas) is real,
// separately-decided future work (see PROJECT_TRACKER.md), not guessed at
// here.
const MONGOLIA_SECTION_ROLES = ["Content Manager", "Event Manager", "Club Manager", "Member Support"];

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
