"use client";

import { Check } from "lucide-react";
import { useMember } from "@/contexts/member-context";

// Content here is the client's own copy, verbatim from
// CLC_Membership_Text_EN_Updated.docx (received 2026-10-05, now in legal/) —
// pricing, welcome gifts and discount terms are his, not invented. Replaces
// the earlier version drawn from the spec PDF's plainer tier descriptions.
//
// This is the "Explore Membership" conversion path the spec requires every
// Newsletter Subscriber page to lead to (PDF page 6, "Newsletter page rule").
// Not gated behind RequireAccess — intended destination for Newsletter/
// Mongolia members, harmless for anyone else to view.
//
// The 6-Month tier (added 2026-10-07 — MembershipTier.SIX_MONTH, see
// schema.prisma) has "Norway only" as a plain label, no technical region
// restriction (client confirmed 2026-10-05) — same access level as ANNUAL.
//
// No purchase buttons yet: the real Shopify products exist now (Milestone 4,
// 2026-10-06/07), but the actual checkout/auto-activation wiring doesn't. An
// honest "coming soon" note instead of a broken or guessed checkout link, same
// reasoning as before,
// now applied to four tiers instead of two.
export default function ExploreMembershipPage() {
  const member = useMember();

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Explore Membership</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Choose your membership and discover a closer connection to cashmere.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TierCard
          title="Newsletter"
          price="Free"
          term="Stay connected to the world of cashmere."
          current={member.membershipTier === "NEWSLETTER"}
          features={[
            "Newsletter with stories and inspiration",
            "Selected Stories & Knowledge",
            "Collection previews and club news",
            "Wishlist and personal profile",
          ]}
        />
        <TierCard
          title="6-Month Member"
          price="€160"
          term="6-month membership · One-time payment"
          tagline="Six months of cashmere, stories and exclusive benefits."
          badge="Available in Norway only"
          gift="Welcome cashmere wrist warmers · value €99. Sent after one month."
          current={member.membershipTier === "SIX_MONTH"}
          features={[
            "Full Stories & Knowledge access",
            "Member offers and early access",
            "Explore designs in the Design Lab",
          ]}
        />
        <TierCard
          title="Annual Member"
          price="€300"
          term="12-month membership"
          tagline="A year of cashmere, stories and exclusive benefits."
          gift="Welcome scarf · value €169"
          discount="20% off until 31 March 2027, 10% member discount thereafter"
          current={member.membershipTier === "ANNUAL"}
          features={[
            "Full Stories & Knowledge access",
            "Member offers and early access",
            "Explore designs in the Design Lab",
          ]}
        />
        <TierCard
          title="Founding Member"
          price="€1,000"
          term="5-year membership"
          tagline="Join from the beginning and help shape what comes next."
          badge="Limited to 1,500 members"
          gift="Welcome blanket · value €599"
          discount="20% off until 31 March 2027, 15% member discount thereafter"
          current={member.isFoundingMember}
          features={[
            "Full Stories & Knowledge access",
            "Exclusive offers and early access",
            "Vote for your favourites in the Design Lab",
          ]}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-cashmere-sidebar/60 px-4 py-3 text-sm text-cashmere-text-muted">
        <p>Memberships open on 1 November 2026. Purchasing isn&apos;t available yet — check back soon.</p>
      </div>
    </div>
  );
}

function TierCard({
  title,
  price,
  term,
  tagline,
  badge,
  gift,
  discount,
  current,
  features,
}: {
  title: string;
  price: string;
  term: string;
  tagline?: string;
  badge?: string;
  gift?: string;
  discount?: string;
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-cashmere-text">{title}</h2>
          {current && (
            <span className="rounded-full bg-cashmere-accent px-2 py-0.5 text-[10px] font-semibold text-white">
              YOUR PLAN
            </span>
          )}
          {badge && (
            <span className="rounded-full bg-cashmere-sidebar px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-text-muted">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 font-serif text-2xl text-cashmere-text">{price}</p>
        <p className="text-xs text-cashmere-text-muted">{term}</p>
        {tagline && <p className="mt-2 text-sm text-cashmere-text-muted">{tagline}</p>}
      </div>

      {gift && (
        <p className="rounded-lg bg-cashmere-accent/10 px-3 py-2 text-xs text-cashmere-accent-dark">{gift}</p>
      )}

      <ul className="flex flex-col gap-2 text-sm text-cashmere-text-muted">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-cashmere-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {discount && <p className="text-xs text-cashmere-text-muted">{discount}</p>}

      <button
        disabled
        className="mt-auto w-full cursor-not-allowed rounded-full border border-cashmere-border px-4 py-2 text-sm font-medium text-cashmere-text-muted"
      >
        Become a {title}
      </button>
    </div>
  );
}
