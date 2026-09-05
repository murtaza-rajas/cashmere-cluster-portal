"use client";

import { useEffect, useState } from "react";
import {
  Star,
  Gift,
  Tag,
  CalendarDays,
  Crown,
  Package,
  Truck,
  Newspaper,
  PlayCircle,
  ArrowRight,
  User,
  ShoppingBag,
  CalendarHeart,
  Heart,
  Sparkles,
} from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { formatMemberId, formatMonthYear, membershipTierLabel, fetchMemberOrders } from "@/lib/api";
import { getAccessLevel } from "@/lib/access";

// Matches founding-member-dashboard.jpeg section-for-section. Real data used
// wherever we have it (name, tier, join date, Member ID, real order count via
// GET /members/me/orders, real benefit copy from the client's confirmed My
// Benefits table — PROJECT_TRACKER.md Section 3c). Everything the mockup shows
// that we have no real data source for yet (the hero/release photography, the
// "Autumn Collection 2027" countdown, News & Updates articles, the Behind the
// Cashmere video, package tracking) is an honest "coming soon" placeholder
// rather than invented content — same discipline as the rest of this portal.
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
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => {
    fetchMemberOrders()
      .then((orders) => setOrderCount(orders.length))
      .catch(() => setOrderCount(null));
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
            Cashmere Lovers {membershipTierLabel(member.membershipTier, member.isFoundingMember)}
          </p>
          <div className="mt-3 h-px w-10 bg-cashmere-border" />
          <p className="mt-3 text-cashmere-text-muted">Thank you for being part of our journey.</p>
        </div>
      </section>

      <BenefitsRow />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-cashmere-border bg-cashmere-sidebar/60 p-8 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">Next Members Release</p>
          <p className="font-serif text-2xl text-cashmere-text">Coming soon</p>
          <p className="max-w-md text-sm text-cashmere-text-muted">
            We&apos;re not ready to announce the next collection yet — check back soon.
          </p>
        </div>

        <div className="rounded-2xl border border-cashmere-border bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">My Orders</p>
            <a
              href="/orders"
              className="flex items-center gap-1 text-xs font-medium text-cashmere-accent hover:underline"
            >
              View all orders <ArrowRight size={12} />
            </a>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <OrderRow
              icon={Package}
              label="Total Orders"
              value={orderCount !== null ? String(orderCount) : "—"}
              detail="View your order history"
            />
            <OrderRow icon={Truck} label="Track a Package" detail="Coming soon" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderPanel
          icon={Newspaper}
          title="Latest News & Updates"
          body="Club news, producer stories and Mongolia updates will appear here."
        />
        <PlaceholderPanel
          icon={PlayCircle}
          title="Behind the Cashmere"
          body="A look at the journey from Mongolia's herds to your wardrobe — video content coming soon."
        />
      </section>

      <section className="grid grid-cols-2 gap-4 rounded-2xl border border-cashmere-border bg-white p-6 sm:grid-cols-4">
        <UtilityLink icon={ShoppingBag} title="Exclusive Collections" description="Shop member-only collections and pre-orders" />
        <UtilityLink icon={CalendarHeart} title="Members Events" description="Join exclusive events, launches and previews" />
        <UtilityLink
          icon={Gift}
          title="My Benefits"
          description="See all your member benefits and rewards"
          href="/benefits"
          linkLabel="View my benefits →"
        />
        <UtilityLink
          icon={User}
          title="Update Profile"
          description="Manage your details and preferences"
          href="/profile"
          linkLabel="Go to profile →"
        />
      </section>

      <ThankYouBand />
    </div>
  );
}

function BenefitsRow() {
  const member = useMember();
  const founding = member.isFoundingMember;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative overflow-hidden rounded-2xl bg-cashmere-navy p-5 text-white lg:col-span-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cashmere-accent">
          <Star size={14} strokeWidth={1.75} fill="currentColor" />
          {founding ? "Founding Member" : "Member"}
        </div>
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/60">Member since</p>
            <p className="mt-1 font-medium">{formatMonthYear(member.createdAt)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/60">Member ID</p>
            <p className="mt-1 font-medium">{formatMemberId(member.id)}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-white/15 pt-3 text-xs text-white/70">
          Thank you for supporting genuine cashmere.
        </div>
      </div>

      {founding && (
        <BenefitCard icon={Gift} title="Founders Scarf" description="Cashmere scarf, ~€200 value — your one-time welcome gift." />
      )}
      <BenefitCard
        icon={Tag}
        title="Members Discount"
        description={founding ? "20% until 31 March 2027, then permanent 15%" : "10% on eligible purchases"}
        badge="ACTIVE"
      />
      <BenefitCard
        icon={CalendarDays}
        title="Early Access"
        description="Be the first to discover new collections"
        badge="ACTIVE"
      />
      {founding && (
        <BenefitCard icon={Crown} title="Future Club Benefits" description="Priority access as new benefits are introduced" badge="ACTIVE" />
      )}
    </section>
  );
}

function BenefitCard({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: typeof Gift;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-cashmere-border bg-white p-5">
      <Icon size={20} strokeWidth={1.5} className="text-cashmere-accent" />
      <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text">{title}</p>
      <p className="flex-1 text-sm text-cashmere-text-muted">{description}</p>
      {badge && (
        <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
          {badge}
        </span>
      )}
    </div>
  );
}

function OrderRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Package;
  label: string;
  value?: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cashmere-sidebar/60">
        <Icon size={16} strokeWidth={1.75} className="text-cashmere-accent" />
      </div>
      <div>
        <p className="text-sm font-medium text-cashmere-text">
          {label}
          {value && <span className="ml-2 text-cashmere-accent">{value}</span>}
        </p>
        <p className="text-xs text-cashmere-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function PlaceholderPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Newspaper;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-cashmere-border bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">{title}</p>
      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-cashmere-sidebar/60 px-6 py-10 text-center">
        <Icon size={24} strokeWidth={1.5} className="text-cashmere-text-muted" />
        <p className="max-w-xs text-sm text-cashmere-text-muted">{body}</p>
      </div>
    </div>
  );
}

function UtilityLink({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
}: {
  icon: typeof ShoppingBag;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  const content = (
    <div className="flex flex-col items-center gap-2 text-center">
      <Icon size={20} strokeWidth={1.5} className="text-cashmere-accent" />
      <p className="text-sm font-medium text-cashmere-text">{title}</p>
      <p className="text-xs text-cashmere-text-muted">{description}</p>
      {href ? (
        <span className="mt-1 text-xs font-medium text-cashmere-accent">{linkLabel ?? "Go →"}</span>
      ) : (
        <span className="mt-1 text-xs text-cashmere-text-muted">Coming soon</span>
      )}
    </div>
  );

  return href ? <a href={href}>{content}</a> : content;
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
