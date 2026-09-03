"use client";

import { useEffect, useState } from "react";
import { Shirt } from "lucide-react";
import { fetchMemberCollection, CollectionItem } from "@/lib/api";
import { RequireAccess } from "@/components/require-access";

// "No access" for Newsletter/Mongolia per the client's spec access matrix — the
// PDF's own requirement is that restricted pages must be blocked even via direct
// URL, hence RequireAccess wrapping the whole page rather than just hiding the
// nav link (already true — see components/sidebar.tsx).
//
// Fed by MemberOrderCache.lineItems (populated by the order-sync webhook — see
// PROJECT_TRACKER.md). No images: real Shopify order line items don't include
// one (that lives on the Product resource, needing a separate Admin/Storefront
// API call we don't have credentials configured for yet) — an icon placeholder
// instead of a missing/broken image, honest about what's actually available.
export default function CollectionPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; items: CollectionItem[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchMemberCollection()
      .then((items) => setState({ status: "loaded", items }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, []);

  return (
    <RequireAccess area="myCollection">
      <div className="flex max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-cashmere-text">My Collection</h1>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading your collection…</p>}

        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load your collection ({state.message}). Try refreshing the page.
          </p>
        )}

        {state.status === "loaded" && state.items.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <Shirt size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">No pieces yet</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">
              Cashmere pieces you purchase from CashmereHouse.com will appear here.
            </p>
          </div>
        )}

        {state.status === "loaded" && state.items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.items.map((item, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5">
                <div className="flex h-32 items-center justify-center rounded-lg bg-cashmere-sidebar/60">
                  <Shirt size={32} strokeWidth={1.5} className="text-cashmere-text-muted" />
                </div>
                <div>
                  <p className="font-medium text-cashmere-text">{item.title}</p>
                  {item.variantTitle && <p className="text-sm text-cashmere-text-muted">{item.variantTitle}</p>}
                </div>
                <div className="flex items-center justify-between border-t border-cashmere-border pt-3 text-xs text-cashmere-text-muted">
                  <span>
                    {item.quantity > 1 ? `Qty ${item.quantity} · ` : ""}
                    {item.orderNumber}
                  </span>
                  <span>
                    {new Date(item.orderDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
