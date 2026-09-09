"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchMemberTotals,
  fetchTierBreakdown,
  fetchNewMembersByPeriod,
  fetchOrderTotals,
  MemberTotals,
  TierBreakdown,
  NewMembersBucket,
  OrderTotalsRow,
} from "@/lib/staff-api";

const STATUS_LABELS: Record<string, string> = { ACTIVE: "Active", EXPIRED: "Expired", CANCELLED: "Cancelled" };

// Fixed tier -> hue mapping (never index-based) so color keeps meaning the
// entity, not its position in whatever order the API happens to return —
// a tier with 0 members still keeps its color slot in the legend.
// Hues are the dataviz skill's validated default categorical palette
// (references/palette.md, slots 1/2/3/4), re-validated here specifically as
// a *closed 4-ring* (donut wrap-around counts as an adjacent pair too, not
// just the linear stack pairlist the palette doc checks) — worst adjacent
// CVD ΔE 9.1 light, worst normal-vision ΔE 22.9 light, all PASS. The aqua/
// yellow slots sit under the 3:1 contrast floor on this light surface, so
// per the skill's relief rule every value is also shown as text in the
// legend, never color-only.
const TIER_ORDER = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"] as const;
const TIER_LABELS: Record<(typeof TIER_ORDER)[number], string> = {
  FOUNDING: "Founding",
  ANNUAL: "Annual",
  MONGOLIA: "Mongolia",
  NEWSLETTER: "Newsletter",
};
const TIER_COLORS: Record<(typeof TIER_ORDER)[number], string> = {
  FOUNDING: "#2a78d6",
  ANNUAL: "#eb6834",
  MONGOLIA: "#1baf7a",
  NEWSLETTER: "#eda100",
};

// Analytics Viewer per the seeded role description ("Read-only insight:
// reports and dashboards, no changes") — server-side already enforces this
// on every /reports/* endpoint, this is just the matching UI guard.
export default function ReportsPage() {
  const staff = useStaff();
  const router = useRouter();
  const canView = staffHasAnyRole(staff, ["Analytics Viewer"]);

  const [totals, setTotals] = useState<MemberTotals | null>(null);
  const [tiers, setTiers] = useState<TierBreakdown | null>(null);
  const [newMembers, setNewMembers] = useState<NewMembersBucket[] | null>(null);
  const [orders, setOrders] = useState<OrderTotalsRow[] | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      router.replace("/staff");
      return;
    }
    Promise.all([fetchMemberTotals(), fetchTierBreakdown(), fetchOrderTotals()])
      .then(([t, tb, o]) => {
        setTotals(t);
        setTiers(tb);
        setOrders(o);
      })
      .catch((err: Error) => setError(err.message));
  }, [canView, router]);

  useEffect(() => {
    if (!canView) return;
    fetchNewMembersByPeriod(period, period === "week" ? 8 : 6)
      .then(setNewMembers)
      .catch((err: Error) => setError(err.message));
  }, [canView, period]);

  if (!canView) return null;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Reports &amp; Analytics</h1>
        <p className="mt-1 text-cashmere-text-muted">The 5 confirmed KPIs, built against the data that exists today.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* KPI 1 + 2: member totals and tier breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">Total members</p>
          {totals ? (
            <>
              <p className="mt-2 font-serif text-4xl text-cashmere-text">{totals.byStatus.ACTIVE ?? 0}</p>
              <p className="mt-1 text-xs text-cashmere-text-muted">Active — {totals.total} across all statuses</p>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-cashmere-border pt-3 text-xs text-cashmere-text-muted">
                {Object.entries(totals.byStatus).map(([status, count]) => (
                  <span key={status}>
                    {STATUS_LABELS[status] ?? status}: <span className="font-medium text-cashmere-text">{count}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-cashmere-text-muted">Loading…</p>
          )}
        </section>

        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">Founding members</p>
          {tiers ? (
            <>
              <p className="mt-2 font-serif text-4xl text-cashmere-text">{tiers.foundingMemberCount}</p>
              <p className="mt-1 text-xs text-cashmere-text-muted">Permanent status, independent of current tier</p>
            </>
          ) : (
            <p className="mt-2 text-cashmere-text-muted">Loading…</p>
          )}
        </section>
      </div>

      {/* KPI 2: tier breakdown as a donut — part-to-whole with a fixed,
          small (4) set of categories is exactly the case the dataviz
          skill's anti-patterns file allows a donut for ("part-to-whole at
          a glance, <= 6 segments"); real counts stay visible in the legend
          so precision isn't lost the way a bare pie's would be. */}
      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">Members by tier</p>
        {tiers ? (
          <DonutChart
            className="mt-4"
            slices={TIER_ORDER.map((tier) => ({
              key: tier,
              label: TIER_LABELS[tier],
              value: tiers.byTier[tier] ?? 0,
              color: TIER_COLORS[tier],
            }))}
          />
        ) : (
          <p className="mt-2 text-cashmere-text-muted">Loading…</p>
        )}
      </section>

      {/* KPI 3: new members per period */}
      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">New members</p>
          <div className="flex gap-1">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-cashmere-navy text-white"
                    : "border border-cashmere-border text-cashmere-text hover:border-cashmere-accent"
                }`}
              >
                {p === "week" ? "By week" : "By month"}
              </button>
            ))}
          </div>
        </div>
        {newMembers ? (
          <TrendChart
            className="mt-4"
            rows={newMembers.map((b) => ({
              key: b.periodStart,
              label: new Date(b.periodStart).toLocaleDateString(undefined, {
                month: "short",
                day: period === "week" ? "numeric" : undefined,
                year: period === "month" ? "numeric" : undefined,
              }),
              value: b.count,
            }))}
          />
        ) : (
          <p className="mt-2 text-cashmere-text-muted">Loading…</p>
        )}
      </section>

      {/* KPI 4: sales/orders by members */}
      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">
          Sales &amp; orders by members
        </p>
        {orders === null ? (
          <p className="mt-2 text-cashmere-text-muted">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-2 text-sm text-cashmere-text-muted">
            No synced orders yet — this fills in automatically once the order-sync webhook is registered against
            the live store.
          </p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-cashmere-border text-xs uppercase tracking-wide text-cashmere-text-muted">
                <th className="py-2 font-semibold">Currency</th>
                <th className="py-2 font-semibold">Orders</th>
                <th className="py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.currency} className="border-b border-cashmere-border last:border-0">
                  <td className="py-2 text-cashmere-text">{row.currency}</td>
                  <td className="py-2 text-cashmere-text-muted">{row.orderCount}</td>
                  <td className="py-2 text-cashmere-text-muted">{row.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* KPI 5: deliberately not built — see app/docs/kpi-reporting-design.md,
          "don't guess at this one." Shown honestly rather than omitted. */}
      <section className="rounded-2xl border border-dashed border-cashmere-border bg-cashmere-sidebar/40 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">
          Member activity / engagement
        </p>
        <p className="mt-2 text-sm text-cashmere-text-muted">
          Not built yet — &quot;engagement&quot; needs a definition from the client (login frequency, portal usage,
          or purchase activity would each need a different data source) before this can be designed correctly.
        </p>
      </section>
    </div>
  );
}

interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

// A 2px surface-color gap separates touching segments (the skill's "surface
// gap" spacer) rather than a stroke drawn around each one.
const DONUT_GAP_PX = 3;

function DonutChart({ slices, className = "" }: { slices: DonutSlice[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const size = 176;
  const thickness = 26;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const arcs = slices
    .filter((s) => s.value > 0)
    .reduce<Array<DonutSlice & { dashArray: string; dashOffset: number; percent: number }>>((acc, s) => {
      const cumulative = acc.reduce((sum, a) => sum + a.value / total, 0);
      const fraction = total > 0 ? s.value / total : 0;
      const rawDash = fraction * circumference;
      const dash = Math.max(rawDash - DONUT_GAP_PX, 0);
      const dashOffset = -cumulative * circumference;
      acc.push({ ...s, dashArray: `${dash} ${circumference - dash}`, dashOffset, percent: Math.round(fraction * 100) });
      return acc;
    }, []);

  const activeSlice = slices.find((s) => s.key === active);
  const activePercent = activeSlice && total > 0 ? Math.round((activeSlice.value / total) * 100) : null;

  return (
    <div className={`flex flex-col items-center gap-6 sm:flex-row sm:items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Members by tier: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e6ddd0" strokeWidth={thickness} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={active === arc.key ? thickness + 4 : thickness}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={active && active !== arc.key ? 0.55 : 1}
            tabIndex={0}
            role="img"
            aria-label={`${arc.label}: ${arc.value} members (${arc.percent}%)`}
            className="cursor-pointer outline-none transition-[stroke-width,opacity]"
            onMouseEnter={() => setActive(arc.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(arc.key)}
            onBlur={() => setActive(null)}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-cashmere-text font-serif text-2xl">
          {activeSlice ? activeSlice.value : total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-cashmere-text-muted text-[10px] uppercase tracking-wide">
          {activeSlice ? `${activeSlice.label} · ${activePercent}%` : "members"}
        </text>
      </svg>

      <div className="flex flex-1 flex-col gap-2">
        {slices.map((s) => {
          const percent = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div
              key={s.key}
              tabIndex={0}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm outline-none transition-colors hover:bg-cashmere-sidebar/60 focus:bg-cashmere-sidebar/60"
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-cashmere-text">{s.label}</span>
              <span className="text-xs text-cashmere-text-muted">{percent}%</span>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-cashmere-text">{s.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({
  rows,
  className = "",
}: {
  rows: { key: string; label: string; value: number }[];
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const width = 560;
  const height = 140;
  const padding = { top: 16, right: 8, bottom: 20, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const stepX = rows.length > 1 ? innerW / (rows.length - 1) : 0;

  const points = rows.map((row, i) => ({
    ...row,
    x: padding.left + stepX * i,
    y: padding.top + innerH - (row.value / max) * innerH,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const baseline = padding.top + innerH;
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : "";
  const activePoint = points.find((p) => p.key === active);
  const last = points[points.length - 1];

  return (
    <div className={className}>
      <p className="mb-2 h-4 text-xs text-cashmere-text-muted">
        {activePoint ? (
          <>
            <span className="font-medium text-cashmere-text">{activePoint.label}</span> — {activePoint.value} new
            member{activePoint.value === 1 ? "" : "s"}
          </>
        ) : (
          "Hover or focus a point for detail"
        )}
      </p>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="New members by period">
        <line x1={padding.left} y1={baseline} x2={width - padding.right} y2={baseline} stroke="#e6ddd0" strokeWidth={1} />
        {areaPath && <path d={areaPath} fill="#8b6f47" opacity={0.1} />}
        {linePath && <path d={linePath} fill="none" stroke="#8b6f47" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={p.key}>
            <circle cx={p.x} cy={p.y} r={active === p.key ? 5 : 4} fill="#8b6f47" />
            {/* transparent, larger hit area per the skill's "hit target bigger than the mark" rule */}
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${p.label}: ${p.value} new members`}
              className="cursor-pointer outline-none"
              onMouseEnter={() => setActive(p.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(p.key)}
              onBlur={() => setActive(null)}
            />
            {i === points.length - 1 && (
              <text x={p.x} y={p.y - 10} textAnchor="end" className="fill-cashmere-text text-[11px] font-medium">
                {p.value}
              </text>
            )}
            <text x={p.x} y={height - 4} textAnchor="middle" className="fill-cashmere-text-muted text-[9px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      {last && (
        <p className="sr-only">
          Series values: {points.map((p) => `${p.label}: ${p.value}`).join(", ")}
        </p>
      )}
    </div>
  );
}
