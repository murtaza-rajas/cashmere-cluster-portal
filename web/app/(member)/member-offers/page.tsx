"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { RequireAccess } from "@/components/require-access";
import { fetchMyOffers, type Benefit } from "@/lib/api";
import { resolveBenefitIcon } from "@/lib/benefit-icons";

// Real, staff-curated content (see BenefitsService / /benefit-catalog admin) —
// replacing what used to be a fixed "coming soon" placeholder with no data
// model behind it at all. Still shows an honest empty state below when staff
// haven't added any offers for this member's tier yet, rather than fabricating
// content.
export default function MemberOffersPage() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; offers: Benefit[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchMyOffers()
      .then((offers) => setState({ status: "loaded", offers }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, []);

  return (
    <RequireAccess area="memberOffers">
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Member Offers</h1>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading offers…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load offers ({state.message}).
          </p>
        )}

        {state.status === "loaded" && state.offers.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <Tag size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">Member Offers coming soon</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">
              Exclusive offers from Cashmere House and participating partners will appear here.
            </p>
          </div>
        )}

        {state.status === "loaded" && state.offers.length > 0 && (
          <div className="flex flex-col gap-4">
            {state.offers.map((offer) => {
              const Icon = resolveBenefitIcon(offer.icon);
              return (
                <div
                  key={offer.id}
                  className="flex items-start gap-4 rounded-2xl border border-cashmere-border bg-white p-6"
                >
                  <Icon size={22} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cashmere-accent" />
                  <div>
                    <p className="font-medium text-cashmere-text">{offer.title}</p>
                    {offer.description && (
                      <p className="mt-1 text-sm text-cashmere-text-muted">{offer.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
