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
    <div className="flex max-w-4xl flex-col gap-6">
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

      {/* KPI 2: tier breakdown as a bar list — one hue, magnitude by length,
          identity by direct label (not by color), so there's no categorical
          palette to invent or validate for what's ultimately 3-4 rows. */}
      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">Members by tier</p>
        {tiers ? (
          <BarList
            className="mt-4"
            rows={Object.entries(tiers.byTier).map(([tier, count]) => ({ key: tier, label: tier, value: count }))}
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
          <BarList
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

function BarList({
  rows,
  className = "",
}: {
  rows: { key: string; label: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3 text-sm" title={`${row.label}: ${row.value}`}>
          <span className="w-20 shrink-0 text-xs text-cashmere-text-muted">{row.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-cashmere-sidebar/60">
            <div
              className="h-full rounded-full bg-cashmere-accent"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-medium text-cashmere-text">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
