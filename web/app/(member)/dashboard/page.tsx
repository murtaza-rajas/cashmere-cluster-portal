"use client";

import { TrendingUp, Gift, Shirt, Heart, Sparkles } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { formatMemberId, formatMonthYear, membershipTierLabel } from "@/lib/api";
import { getAccessLevel } from "@/lib/access";

// Matches the client's mockup (6.3. Cashmere Loveres.png) for the hero + top stat
// row. Only the fields backed by real data are live (name, tier, join date,
// Founding status); the four stat cards below show an honest "not tracked yet"
// state rather than invented numbers — order/purchase history needs Milestone 4's
// Shopify sync, and benefits/wishlist need catalogs that don't exist yet either.
// Swap the placeholders for real values as those land, the layout won't need to change.
//
// Newsletter/Mongolia tiers get a different, simpler view entirely — per the
// client's spec (access matrix, page 5): "Simple home page", not the full
// dashboard. Per the spec's own Newsletter page rule (page 6): must end with a
// "Become a Member" section, and must never show member savings, benefits,
// exclusive offers, or restricted invitations — locked previews are fine, the
// real restricted content is not.
export default function DashboardPage() {
  const member = useMember();
  const displayName = member.firstName ?? member.email;

  if (getAccessLevel(member.membershipTier, "dashboard") !== "full") {
    return <NewsletterHome displayName={displayName} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-cashmere-border bg-white p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-cashmere-text">Welcome back, {displayName}</h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-cashmere-accent">
          {membershipTierLabel(member.membershipTier, member.isFoundingMember)}
        </p>
        <p className="mt-3 max-w-md text-cashmere-text-muted">
          Thank you for being part of our journey and supporting genuine cashmere.
        </p>

        <dl className="mt-6 flex flex-wrap gap-8 border-t border-cashmere-border pt-6">
          <div>
            <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">Member since</dt>
            <dd className="mt-1 font-medium text-cashmere-text">{formatMonthYear(member.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">Member ID</dt>
            <dd className="mt-1 font-medium text-cashmere-text">{formatMemberId(member.id)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">Status</dt>
            <dd className="mt-1 font-medium text-cashmere-text">
              {membershipTierLabel(member.membershipTier, member.isFoundingMember)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} title="Your Member Savings" pending="Order history not tracked yet" />
        <StatCard icon={Gift} title="Your Benefits" pending="Benefits catalog coming soon" />
        <StatCard icon={Shirt} title="Your Cashmere Collection" pending="Collection tracking coming soon" />
        <StatCard icon={Heart} title="Wishlist" pending="Wishlist feature coming soon" />
      </section>
    </div>
  );
}

function NewsletterHome({ displayName }: { displayName: string }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-cashmere-border bg-white p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-cashmere-text">Welcome, {displayName}</h1>
        <p className="mt-3 max-w-md text-cashmere-text-muted">
          Thank you for being part of the Cashmere Lovers Club newsletter. Explore public stories, events and
          collection previews from here.
        </p>
      </section>

      <section className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
        <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-cashmere-text">Become a Member</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-cashmere-text-muted">
          Founding and Annual members get full access to member offers, exclusive collections, priority events,
          the complete Stories &amp; Knowledge library, and more.
        </p>
        <a
          href="/explore-membership"
          className="mt-6 inline-block rounded-full bg-cashmere-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
        >
          Explore Membership
        </a>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  pending,
}: {
  icon: typeof TrendingUp;
  title: string;
  pending: string;
}) {
  return (
    <div className="rounded-2xl border border-cashmere-border bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">
        <Icon size={16} strokeWidth={1.75} />
        {title}
      </div>
      <p className="mt-4 text-sm text-cashmere-text-muted">{pending}</p>
    </div>
  );
}
