"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Gift, Shirt, Heart, Sparkles, Truck, RotateCcw, ShieldCheck, Headset } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { formatMemberId, formatMonthYear, membershipTierLabel, fetchMemberCollection } from "@/lib/api";
import { getAccessLevel } from "@/lib/access";

// First visual pass toward the client's wireframes (login-ui.jpeg,
// founding-member-dashboard.jpeg, the tier-comparison wireframe) — see
// PROJECT_TRACKER.md Section 3c. Real data used wherever we have it (name, tier,
// join date, Member ID, Founding status, and now the real collection count via
// GET /members/me/collection); everything else the wireframe shows (savings
// amount, benefits tracking, wishlist count, offers, "Next Members Release",
// "Behind the Cashmere") still needs its own data model (Milestone 5) and stays
// an honest placeholder — no fabricated numbers.
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

  return <FullDashboard displayName={displayName} />;
}

function FullDashboard({ displayName }: { displayName: string }) {
  const member = useMember();
  const [collectionCount, setCollectionCount] = useState<number | null>(null);

  useEffect(() => {
    fetchMemberCollection()
      .then((items) => setCollectionCount(items.length))
      .catch(() => setCollectionCount(null));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-cashmere-border bg-white p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cashmere-accent/10 via-transparent to-transparent"
        />
        <div className="relative">
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Welcome back, {displayName}</h1>
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
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} title="Your Member Savings" pending="Not tracked yet" />
        <StatCard icon={Gift} title="Your Benefits" pending="Benefits catalog coming soon" />
        <StatCard
          icon={Shirt}
          title="Your Cashmere Collection"
          pending="Not tracked yet"
          value={collectionCount !== null ? `${collectionCount} piece${collectionCount === 1 ? "" : "s"} owned` : undefined}
          href="/collection"
        />
        <StatCard icon={Heart} title="Wishlist" pending="Wishlist feature coming soon" />
      </section>

      <UtilityRow />
      <ThankYouBand />
    </div>
  );
}

function NewsletterHome({ displayName }: { displayName: string }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-cashmere-border bg-white p-8">
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Welcome, {displayName}</h1>
        <p className="mt-3 max-w-md text-cashmere-text-muted">
          Thank you for being part of the Cashmere Lovers Club newsletter. Explore public stories, events and
          collection previews from here.
        </p>
      </section>

      <section className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
        <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
        <h2 className="mt-4 font-serif text-xl tracking-tight text-cashmere-text">Become a Member</h2>
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
  value,
  href,
}: {
  icon: typeof TrendingUp;
  title: string;
  pending: string;
  value?: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">
        <Icon size={16} strokeWidth={1.75} />
        {title}
      </div>
      <p className={`mt-4 text-sm ${value ? "font-medium text-cashmere-text" : "text-cashmere-text-muted"}`}>
        {value ?? pending}
      </p>
    </div>
  );

  if (href && value) {
    return <a href={href}>{content}</a>;
  }
  return content;
}

// Static marketing copy, no data dependency — matches the wireframe's bottom
// utility row (Free Shipping / Easy Returns / Lifetime Care / Member Support).
function UtilityRow() {
  const items = [
    { icon: Truck, label: "Free Shipping", detail: "On all orders over €200" },
    { icon: RotateCcw, label: "Easy Returns", detail: "30-day return policy" },
    { icon: ShieldCheck, label: "Lifetime Care", detail: "Care & repair for life" },
    { icon: Headset, label: "Member Support", detail: "Priority customer care" },
  ];
  return (
    <section className="grid grid-cols-2 gap-4 rounded-2xl border border-cashmere-border bg-white p-6 sm:grid-cols-4">
      {items.map(({ icon: Icon, label, detail }) => (
        <div key={label} className="flex flex-col items-center gap-2 text-center">
          <Icon size={20} strokeWidth={1.5} className="text-cashmere-accent" />
          <p className="text-sm font-medium text-cashmere-text">{label}</p>
          <p className="text-xs text-cashmere-text-muted">{detail}</p>
        </div>
      ))}
    </section>
  );
}

function ThankYouBand() {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border border-cashmere-border bg-cashmere-sidebar/60 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
      <div className="flex items-center gap-3">
        <Heart size={20} strokeWidth={1.5} className="shrink-0 text-cashmere-accent" />
        <div>
          <p className="font-medium text-cashmere-text">Thank you for being part of something lasting.</p>
          <p className="text-sm text-cashmere-text-muted">Together, we are building the future of cashmere.</p>
        </div>
      </div>
      <p className="font-serif text-sm italic text-cashmere-text-muted">Morten Minde, Founder, Cashmere House</p>
    </section>
  );
}
