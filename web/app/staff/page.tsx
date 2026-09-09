"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Star,
  User,
  Mail,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Gift,
  Newspaper,
  Palette,
  CalendarPlus,
  Image as ImageIcon,
  Receipt,
  ChevronRight,
  Heart,
  ShoppingBag,
} from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchDashboardStats,
  fetchDashboardGrowth,
  fetchDashboardRecentMembers,
  fetchDashboardRecentActivity,
  fetchDashboardPendingTasks,
  DashboardStats,
  DashboardGrowthPoint,
  DashboardRecentMember,
  DashboardActivityItem,
  DashboardPendingTasks,
} from "@/lib/staff-api";
import { DonutChart, TIER_ORDER, TIER_LABELS, TIER_COLORS } from "@/components/charts/donut-chart";

const TOTAL_COLOR = "#1c2a45"; // cashmere-navy — matches the sidebar/accent, not a generic black

// Matches the client's "1.1 ADMIN.png" admin dashboard sketch. Built with
// real data everywhere it exists (member totals/growth/tiers, recent
// members, recent member/order activity, pending GDPR requests) and honest
// "not built yet" states everywhere it doesn't (Design Lab and Stories &
// News have no member-facing feature to summarize at all yet; there's no
// staff-initiated "add member" flow since members are Shopify-OAuth
// self-created; no admin area has a draft/pending-approval concept beyond
// GDPR requests). See PROJECT_TRACKER.md for the full list of substitutions
// made against the sketch and why.
export default function StaffDashboardPage() {
  const staff = useStaff();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [growth, setGrowth] = useState<DashboardGrowthPoint[] | null>(null);
  const [growthMonths, setGrowthMonths] = useState(6);
  const [recentMembers, setRecentMembers] = useState<DashboardRecentMember[] | null>(null);
  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[] | null>(null);
  const [pendingTasks, setPendingTasks] = useState<DashboardPendingTasks | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchDashboardStats(),
      fetchDashboardRecentMembers(5),
      fetchDashboardRecentActivity(5),
      fetchDashboardPendingTasks(),
    ])
      .then(([s, rm, ra, pt]) => {
        setStats(s);
        setRecentMembers(rm);
        setRecentActivity(ra);
        setPendingTasks(pt);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    fetchDashboardGrowth(growthMonths)
      .then(setGrowth)
      .catch((err: Error) => setError(err.message));
  }, [growthMonths]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Dashboard</h1>
          <p className="mt-1 text-cashmere-text-muted">
            Welcome back, {staff.name.split(" ")[0]}. Here&apos;s an overview of Cashmere Lovers Club.
          </p>
        </div>
        <p className="text-sm text-cashmere-text-muted">{today}</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} label="Total Members" entry={stats?.total} />
        <StatCard icon={Star} label="Founding Members" entry={stats?.byTier.FOUNDING} />
        <StatCard icon={User} label="Annual Members" entry={stats?.byTier.ANNUAL} />
        <StatCard icon={Mail} label="Newsletter Members" entry={stats?.byTier.NEWSLETTER} />
        <StatCard emoji="🇲🇳" label="Mongolia Members" entry={stats?.byTier.MONGOLIA} />
      </div>

      {/* Growth + tier breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-cashmere-text">Member Growth</h2>
            <select
              value={growthMonths}
              onChange={(e) => setGrowthMonths(Number(e.target.value))}
              className="rounded-full border border-cashmere-border px-3 py-1 text-xs text-cashmere-text"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>
          {growth ? (
            <MultiLineChart className="mt-4" points={growth} />
          ) : (
            <p className="mt-4 text-cashmere-text-muted">Loading…</p>
          )}
        </section>

        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <h2 className="font-medium text-cashmere-text">Members by Level</h2>
          {stats ? (
            <DonutChart
              className="mt-4 flex-col sm:flex-col sm:items-center"
              centerLabel="Total"
              slices={TIER_ORDER.map((tier) => ({
                key: tier,
                label: TIER_LABELS[tier],
                value: stats.byTier[tier]?.count ?? 0,
                color: TIER_COLORS[tier],
              }))}
            />
          ) : (
            <p className="mt-4 text-cashmere-text-muted">Loading…</p>
          )}
        </section>
      </div>

      {/* Quick Actions + Tasks, Recent Members + Latest Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr_1.3fr]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <h2 className="font-medium text-cashmere-text">Quick Actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              <QuickAction icon={UserPlus} label="Add member" disabled disabledReason="No staff-initiated signup flow — members join via Shopify" />
              <QuickAction icon={Gift} label="Create member offer" href="/staff/benefits" />
              <QuickAction icon={Newspaper} label="Publish a story" disabled disabledReason="Stories & News isn't built yet" />
              <QuickAction icon={Palette} label="Manage Design Lab" disabled disabledReason="Design Lab isn't built yet" />
              <QuickAction icon={CalendarPlus} label="Create event" href="/staff/events" />
              <QuickAction icon={ImageIcon} label="Upload site image" href="/staff/images" />
              <QuickAction icon={Receipt} label="View recent orders" href="/staff/reports" />
            </div>
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-cashmere-text">Tasks &amp; Approvals</h2>
              {!!pendingTasks?.gdprRequestsPending && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                  {pendingTasks.gdprRequestsPending}
                </span>
              )}
            </div>
            <div className="mt-3">
              {pendingTasks ? (
                pendingTasks.gdprRequestsPending > 0 ? (
                  <Link
                    href="/staff/data-requests"
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-cashmere-text transition-colors hover:bg-cashmere-sidebar/60"
                  >
                    <span>
                      {pendingTasks.gdprRequestsPending} GDPR request{pendingTasks.gdprRequestsPending === 1 ? "" : "s"} to
                      handle
                    </span>
                    <ChevronRight size={16} className="text-cashmere-text-muted" />
                  </Link>
                ) : (
                  <p className="px-2 py-2 text-sm text-cashmere-text-muted">All caught up — no pending GDPR requests.</p>
                )
              ) : (
                <p className="px-2 py-2 text-sm text-cashmere-text-muted">Loading…</p>
              )}
              <p className="mt-2 px-2 text-xs text-cashmere-text-muted">
                Other admin areas (offers, events, uploads) apply immediately — there&apos;s no draft/approval queue for
                them yet.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-cashmere-text">Recent Members</h2>
            <Link href="/staff/members" className="text-xs font-medium text-cashmere-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            {recentMembers ? (
              recentMembers.length === 0 ? (
                <p className="text-sm text-cashmere-text-muted">No members yet.</p>
              ) : (
                <table className="w-full min-w-[420px] table-fixed text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-cashmere-text-muted">
                      <th className="pb-2 pr-3 font-semibold">Name</th>
                      <th className="w-24 pb-2 pr-3 font-semibold">Level</th>
                      <th className="w-28 pb-2 pr-3 font-semibold">Region</th>
                      <th className="w-20 pb-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMembers.map((m) => (
                      <tr key={m.id} className="border-t border-cashmere-border">
                        <td className="truncate py-2 pr-3 text-cashmere-text" title={m.name}>
                          {m.name}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-cashmere-text-muted">
                          {TIER_LABELS[m.tier as keyof typeof TIER_LABELS] ?? m.tier}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-cashmere-text-muted">
                          {m.region === "MONGOLIA" ? "Mongolia" : "International"}
                        </td>
                        <td className="whitespace-nowrap py-2">
                          <span className="inline-flex items-center gap-1 text-xs text-cashmere-text-muted">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${m.status === "ACTIVE" ? "bg-green-600" : "bg-cashmere-text-muted"}`}
                            />
                            {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <p className="text-sm text-cashmere-text-muted">Loading…</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-cashmere-text">Latest Activity</h2>
            <Link href="/staff/audit-log" className="text-xs font-medium text-cashmere-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {recentActivity ? (
              recentActivity.length === 0 ? (
                <p className="text-sm text-cashmere-text-muted">No recent activity yet.</p>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    {item.type === "member_joined" ? (
                      <UserPlus size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cashmere-accent" />
                    ) : (
                      <ShoppingBag size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cashmere-accent" />
                    )}
                    <div className="flex-1">
                      <p className="text-cashmere-text">{item.message}</p>
                      <p className="text-xs text-cashmere-text-muted">{formatRelativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                ))
              )
            ) : (
              <p className="text-sm text-cashmere-text-muted">Loading…</p>
            )}
          </div>
        </section>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={Palette}
          title="Design Lab"
          description="Manage featured designs, voting and production status."
          ctaLabel="Manage Designs"
          href={staffHasAnyRole(staff, ["Content Manager"]) ? "/staff/design-lab" : undefined}
        />
        <FeatureCard
          icon={Newspaper}
          title="Stories & News"
          description="Create and manage stories, designer spotlights and updates."
          ctaLabel="Coming soon"
        />
        <FeatureCard
          icon={Gift}
          title="Member Offers"
          description="Create special offers for Founding, Annual, Newsletter and Mongolia members."
          ctaLabel="Manage Offers"
          href={staffHasAnyRole(staff, ["Club Manager"]) ? "/staff/benefits" : undefined}
        />
        <FeatureCard
          icon={Heart}
          title="Events"
          description="Plan and manage events, webinars and invitations."
          ctaLabel="Manage Events"
          href={staffHasAnyRole(staff, ["Event Manager"]) ? "/staff/events" : undefined}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  emoji,
  label,
  entry,
}: {
  icon?: typeof Users;
  emoji?: string;
  label: string;
  entry?: { count: number; deltaPercent: number | null };
}) {
  return (
    <div className="rounded-2xl border border-cashmere-border bg-white p-5">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={18} strokeWidth={1.5} className="text-cashmere-accent" />}
        {emoji && <span className="text-lg leading-none">{emoji}</span>}
        <p className="text-xs font-medium text-cashmere-text-muted">{label}</p>
      </div>
      <p className="mt-2 font-serif text-3xl text-cashmere-text">{entry ? entry.count.toLocaleString() : "—"}</p>
      {entry && entry.deltaPercent !== null ? (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            entry.deltaPercent >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {entry.deltaPercent >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {formatDeltaPercent(entry.deltaPercent)}{" "}
          <span className="font-normal text-cashmere-text-muted">vs last month</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-cashmere-text-muted">{entry ? "No prior data yet" : " "}</p>
      )}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  disabled,
  disabledReason,
}: {
  icon: typeof Users;
  label: string;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const content = (
    <>
      <Icon size={16} strokeWidth={1.5} className={disabled ? "text-cashmere-text-muted" : "text-cashmere-accent"} />
      <span className="flex-1">{label}</span>
      {!disabled && <ChevronRight size={14} className="text-cashmere-text-muted" />}
    </>
  );
  const className =
    "flex items-center gap-2 rounded-lg bg-cashmere-sidebar/60 px-3 py-2 text-sm" +
    (disabled ? " text-cashmere-text-muted cursor-not-allowed" : " text-cashmere-text transition-colors hover:bg-cashmere-sidebar");

  if (disabled) {
    return (
      <div className={className} title={disabledReason}>
        {content}
      </div>
    );
  }
  return (
    <Link href={href!} className={className}>
      {content}
    </Link>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  ctaLabel,
  href,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  ctaLabel: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-cashmere-border bg-white">
      <div className="flex h-32 items-center justify-center bg-cashmere-sidebar">
        <Icon size={32} strokeWidth={1.25} className="text-cashmere-accent" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-lg text-cashmere-text">{title}</h3>
        <p className="mt-1 flex-1 text-sm text-cashmere-text-muted">{description}</p>
        {href ? (
          <Link
            href={href}
            className="mt-4 inline-flex items-center justify-center gap-1 rounded-lg bg-cashmere-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
          >
            {ctaLabel} →
          </Link>
        ) : (
          <span className="mt-4 inline-flex items-center justify-center rounded-lg border border-dashed border-cashmere-border px-3 py-2 text-sm text-cashmere-text-muted">
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// Caps the displayed magnitude rather than the underlying value — a real,
// common dashboard convention for month-over-month deltas, since an actual
// percentage in the tens of thousands (which the dev DB's heavily
// test-polluted member counts can genuinely produce) is unreadable and
// doesn't happen with real, organic growth in production.
function formatDeltaPercent(deltaPercent: number): string {
  const sign = deltaPercent >= 0 ? "+" : "-";
  const magnitude = Math.abs(deltaPercent);
  return magnitude > 999 ? `${sign}999%+` : `${sign}${magnitude}%`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function MultiLineChart({ points, className = "" }: { points: DashboardGrowthPoint[]; className?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const series = [
    { key: "TOTAL", label: "Total", color: TOTAL_COLOR, values: points.map((p) => p.total) },
    ...TIER_ORDER.map((tier) => ({
      key: tier,
      label: TIER_LABELS[tier],
      color: TIER_COLORS[tier],
      values: points.map((p) => p.byTier[tier] ?? 0),
    })),
  ];
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const yFor = (v: number) => padding.top + innerH - (v / max) * innerH;
  const xFor = (i: number) => padding.left + stepX * i;
  const baseline = padding.top + innerH;

  const labels = points.map((p) =>
    new Date(p.periodStart).toLocaleDateString(undefined, { month: "short" }),
  );

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-cashmere-text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <p className="mb-2 h-4 text-xs text-cashmere-text-muted">
        {active !== null ? (
          <span className="flex flex-wrap gap-x-3">
            <span className="font-medium text-cashmere-text">
              {new Date(points[active].periodStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            {series.map((s) => (
              <span key={s.key}>
                {s.label}: <span className="font-medium text-cashmere-text">{s.values[active]}</span>
              </span>
            ))}
          </span>
        ) : (
          "Hover or focus a month for detail"
        )}
      </p>

      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Member growth by month">
        <line x1={padding.left} y1={baseline} x2={width - padding.right} y2={baseline} stroke="#e6ddd0" strokeWidth={1} />

        {/* Subtle area under Total only, matching the sketch's emphasis on the headline series */}
        {(() => {
          const totalSeries = series[0];
          const linePath = totalSeries.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
          const areaPath = `${linePath} L ${xFor(points.length - 1)} ${baseline} L ${xFor(0)} ${baseline} Z`;
          return <path d={areaPath} fill={TOTAL_COLOR} opacity={0.06} />;
        })()}

        {series.map((s) => (
          <path
            key={s.key}
            d={s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={s.key === "TOTAL" ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {series.map((s) =>
          s.values.map((v, i) => (
            <circle key={`${s.key}-${i}`} cx={xFor(i)} cy={yFor(v)} r={active === i ? 4 : 3} fill={s.color} />
          )),
        )}

        {active !== null && (
          <line x1={xFor(active)} y1={padding.top} x2={xFor(active)} y2={baseline} stroke="#c3c2b7" strokeWidth={1} />
        )}

        {points.map((_, i) => (
          <g key={i}>
            <rect
              x={xFor(i) - stepX / 2}
              y={padding.top}
              width={stepX || width}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${labels[i]}: ${series.map((s) => `${s.label} ${s.values[i]}`).join(", ")}`}
              className="cursor-pointer outline-none"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
            <text x={xFor(i)} y={height - 4} textAnchor="middle" className="fill-cashmere-text-muted text-[10px]">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
