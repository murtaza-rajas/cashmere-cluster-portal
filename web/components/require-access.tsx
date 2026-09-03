"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMember } from "@/contexts/member-context";
import { getAccessLevel, PortalArea } from "@/lib/access";

// Per the client's spec (cashmere-lovers-club-access-administration-model PDF,
// page 5): "Restricted pages must be blocked even if a user attempts to open the
// URL directly. Hiding a navigation item is not sufficient access control." This
// is the one shared mechanism every portal page should wrap itself in for that —
// content never renders (not even briefly) for a member whose tier maps to "none"
// for this area; they're redirected away instead.
export function RequireAccess({ area, children }: { area: PortalArea; children: React.ReactNode }) {
  const member = useMember();
  const router = useRouter();
  const level = getAccessLevel(member.membershipTier, area);

  useEffect(() => {
    if (level === "none") {
      router.replace("/dashboard");
    }
  }, [level, router]);

  if (level === "none") {
    return null;
  }
  return <>{children}</>;
}
