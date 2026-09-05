"use client";

import { ShoppingBag } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";

// Honest placeholder, not the real feature — same pattern as Member Offers.
// Real blocker (PROJECT_TRACKER.md Section 3c, "Exclusive Collections"): reading
// real Shopify collection/product data needs Storefront API credentials that
// aren't configured yet. The client is explicitly OK with zero/few real
// collections at launch ("build the mechanism, not the content"), but there's
// no mechanism to build yet without those credentials — so this stays a
// structural stub rather than a fabricated product grid.
export default function ExclusiveCollectionsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "exclusiveCollections") === "preview";

  return (
    <RequireAccess area="exclusiveCollections">
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Exclusive Collections</h1>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <ShoppingBag size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <p className="font-medium text-cashmere-text">Exclusive Collections coming soon</p>
          <p className="max-w-sm text-sm text-cashmere-text-muted">
            {isPreview
              ? "Public previews of member-only collections will appear here."
              : "Member-only collections and pre-orders from CashmereHouse.com will appear here."}
          </p>
        </div>
      </div>
    </RequireAccess>
  );
}
