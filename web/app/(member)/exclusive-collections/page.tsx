"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";
import { fetchMyExclusiveCollections, type MemberExclusiveCollection } from "@/lib/api";

// Real, staff-curated content (see ExclusiveCollectionsService /
// /exclusive-collection-catalog admin), replacing the "coming soon"
// placeholder this page was until 2026-10-07. Re-scoped that day (client
// conversation, relayed by Rick): this was always blocked on Shopify
// Storefront API credentials because it was originally meant to show real
// synced Shopify collections/products — now staff submit their own
// collection pitches with a real photo instead, same pattern as Member
// Offers, no Shopify dependency. Still shows an honest empty state below
// when staff haven't added anything for this member's tier yet.
export default function ExclusiveCollectionsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "exclusiveCollections") === "preview";

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; collections: MemberExclusiveCollection[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchMyExclusiveCollections()
      .then((collections) => setState({ status: "loaded", collections }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, []);

  return (
    <RequireAccess area="exclusiveCollections">
      <div className="flex w-full flex-col gap-6">
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Exclusive Collections</h1>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading collections…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load collections ({state.message}).
          </p>
        )}

        {state.status === "loaded" && state.collections.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <ShoppingBag size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">Exclusive Collections coming soon</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">
              {isPreview
                ? "Public previews of member-only collections will appear here."
                : "Member-only collections and pre-orders from CashmereHouse.com will appear here."}
            </p>
          </div>
        )}

        {state.status === "loaded" && state.collections.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {state.collections.map((collection) => (
              <div
                key={collection.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-cashmere-border bg-white"
              >
                <div className="relative h-48 w-full bg-cashmere-sidebar/60">
                  {collection.imageUrl ? (
                    <Image src={collection.imageUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ShoppingBag size={24} strokeWidth={1.5} className="text-cashmere-text-muted" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="font-medium text-cashmere-text">{collection.title}</p>
                  {collection.description && (
                    <p className="mt-1 text-sm text-cashmere-text-muted">{collection.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
