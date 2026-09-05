"use client";

import { Gift, Tag, CalendarDays, Sparkles, Star, Crown } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";

// Real, complete content — the client's own confirmed My Benefits table
// (PROJECT_TRACKER.md Section 3c), not placeholder copy. Per the client's
// note this should eventually be "a real, admin-editable Benefit model per
// tier, not hardcoded copy" — that backend/admin piece isn't built yet (it's
// separate, larger Milestone 5 scope: a new Benefit model + staff CRUD UI);
// this page hardcodes the confirmed table so the real content is live now
// rather than waiting on that follow-up.
const BENEFITS: Record<
  "FOUNDING" | "ANNUAL",
  { icon: typeof Gift; label: string; value: string }[]
> = {
  FOUNDING: [
    { icon: Star, label: "Term", value: "5-year membership" },
    { icon: Star, label: "Status", value: "Founding Member status" },
    { icon: Gift, label: "Welcome gift", value: "Cashmere scarf, ~€200 value" },
    { icon: Tag, label: "Discount", value: "20% until 31 March 2027, then permanent 15%" },
    { icon: CalendarDays, label: "Early access", value: "Selected products/collections" },
    { icon: Sparkles, label: "Offers", value: "Exclusive member offers" },
    { icon: CalendarDays, label: "Events", value: "Exclusive member events" },
    { icon: Crown, label: "Other", value: "Priority access to future Club benefits" },
  ],
  ANNUAL: [
    { icon: Star, label: "Term", value: "1-year membership" },
    { icon: Star, label: "Status", value: "Member status" },
    { icon: Gift, label: "Welcome gift", value: "—" },
    { icon: Tag, label: "Discount", value: "10%" },
    { icon: CalendarDays, label: "Early access", value: "Selected products/collections" },
    { icon: Sparkles, label: "Offers", value: "Standard member offers" },
    { icon: CalendarDays, label: "Events", value: "Selected member events" },
    { icon: Crown, label: "Other", value: "—" },
  ],
};

export default function BenefitsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "myBenefits") === "preview";

  if (isPreview) {
    return (
      <RequireAccess area="myBenefits">
        <div className="flex max-w-2xl flex-col gap-6">
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">My Benefits</h1>
          <div className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
            <h2 className="mt-4 font-serif text-xl tracking-tight text-cashmere-text">Become a Member</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-cashmere-text-muted">
              Founding and Annual members get a welcome gift, a member discount, early access to new collections
              and more. Join to see your full benefits here.
            </p>
            <a
              href="/explore-membership"
              className="mt-6 inline-block rounded-full bg-cashmere-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
            >
              Explore Membership
            </a>
          </div>
        </div>
      </RequireAccess>
    );
  }

  const tier = member.membershipTier === "FOUNDING" ? "FOUNDING" : "ANNUAL";
  const rows = BENEFITS[tier];

  return (
    <RequireAccess area="myBenefits">
      <div className="flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">My Benefits</h1>
          <p className="mt-1 text-cashmere-text-muted">
            {tier === "FOUNDING" ? "As a Founding Member, you receive:" : "As an Annual Member, you receive:"}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
          {rows.map(({ icon: Icon, label, value }, index) => (
            <div
              key={label}
              className={`flex items-start gap-4 px-6 py-4 ${index > 0 ? "border-t border-cashmere-border" : ""}`}
            >
              <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cashmere-accent" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">{label}</p>
                <p className="mt-0.5 font-medium text-cashmere-text">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {tier === "FOUNDING" && (
          <p className="rounded-lg bg-cashmere-accent/10 px-4 py-3 text-sm text-cashmere-accent-dark">
            Your Founding Member status is permanent — it stays with your account even if your paid term isn&apos;t
            renewed.
          </p>
        )}
      </div>
    </RequireAccess>
  );
}
