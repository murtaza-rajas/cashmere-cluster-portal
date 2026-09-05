"use client";

import { Check } from "lucide-react";
import { useMember } from "@/contexts/member-context";

// Content here is drawn directly from the client's spec PDF
// (cashmere-lovers-club-access-administration-model, page 4, "Member and
// subscriber experiences") — not invented copy. This is the "Explore Membership"
// conversion path the spec requires every Newsletter Subscriber page to lead to
// (page 6, "Newsletter page rule"). Not gated behind RequireAccess — it's the
// intended destination for Newsletter/Mongolia members, and harmless for anyone
// else to view.
//
// No upgrade/purchase button yet: that needs real Shopify products and Selling
// Plans, which don't exist yet (Milestone 4 — see PROJECT_TRACKER.md Section 0).
// An honest "coming soon" note here, not a broken or guessed checkout link.
export default function ExploreMembershipPage() {
  const member = useMember();
  const isNewsletter = member.membershipTier === "NEWSLETTER" || member.membershipTier === "MONGOLIA";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Explore Membership</h1>
        <p className="mt-1 text-cashmere-text-muted">
          {isNewsletter
            ? "See what Founding and Annual membership unlocks."
            : "A look at what each membership level includes."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TierCard
          title="Newsletter"
          subtitle="Free"
          current={member.membershipTier === "NEWSLETTER"}
          features={[
            "Simple home page with public and newsletter content",
            "Public collection previews, stories and events",
            "Orders shown when connected to a Shopify customer account",
            "Wishlist, profile and newsletter settings",
          ]}
        />
        <TierCard
          title="Annual Member"
          subtitle="Paid, 1 or 5 year term"
          current={member.membershipTier === "ANNUAL"}
          features={[
            "Full dashboard and standard member functionality",
            "Standard offers, collections, events and annual benefits",
            "Full Stories & Knowledge and Care & Repair access",
            "Standard member support and renewal information",
          ]}
        />
        <TierCard
          title="Founding Member"
          subtitle="Limited to the first 1,500 members"
          current={member.isFoundingMember}
          features={[
            "Full dashboard and complete member functionality",
            "All standard offers plus Founding Member exclusives",
            "Priority or exclusive event access and Founding benefits",
            "Full Stories & Knowledge and Care & Repair access",
            "Priority member support",
          ]}
        />
      </div>

      <p className="rounded-lg bg-cashmere-sidebar/60 px-4 py-3 text-sm text-cashmere-text-muted">
        Upgrading isn&apos;t available yet — check back soon.
      </p>
    </div>
  );
}

function TierCard({
  title,
  subtitle,
  current,
  features,
}: {
  title: string;
  subtitle: string;
  current: boolean;
  features: string[];
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 ${
        current ? "border-cashmere-accent ring-1 ring-cashmere-accent" : "border-cashmere-border"
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-cashmere-text">{title}</h2>
          {current && (
            <span className="rounded-full bg-cashmere-accent px-2 py-0.5 text-[10px] font-semibold text-white">
              YOUR PLAN
            </span>
          )}
        </div>
        <p className="text-xs text-cashmere-text-muted">{subtitle}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-cashmere-text-muted">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-cashmere-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
