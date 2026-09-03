"use client";

import { Tag } from "lucide-react";
import { RequireAccess } from "@/components/require-access";

// Member Offers itself (the actual offers catalog) is Milestone 5 work — no data
// model for it exists yet. This page exists now specifically to prove the access-
// control mechanism (RequireAccess) works end-to-end on a real route: per the
// client's spec, Member Offers is "No access" for Newsletter/Mongolia members,
// and that has to be enforced even via a direct URL, not just by omitting the nav
// link (already true — see components/sidebar.tsx, this link isn't even shown to
// that tier). A Founding/Annual member sees this honest placeholder; a Newsletter/
// Mongolia member visiting this URL directly gets redirected to /dashboard before
// any content renders.
export default function MemberOffersPage() {
  return (
    <RequireAccess area="memberOffers">
      <div className="flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
        <Tag size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
        <p className="font-medium text-cashmere-text">Member Offers coming soon</p>
        <p className="max-w-sm text-sm text-cashmere-text-muted">
          Exclusive offers from Cashmere House and participating partners will appear here.
        </p>
      </div>
    </RequireAccess>
  );
}
