"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchOrderCatalog, StaffOrder } from "@/lib/staff-api";
import { membershipTierLabel } from "@/lib/api";

// Shopify & Orders admin view (Milestone 5 checklist) — Commerce Manager,
// a role seeded from Milestone 1 ("Shopify and commercial content:
// products, collections, discounts, order view") that had no page of its
// own until now. Real, synced order data only (MemberOrderCache, filled by
// the order-sync webhooks) — read-only, cross-member, so staff can browse
// what's come in without having to find a member first (that per-member
// view already exists on /staff/members/[id]).
export default function StaffOrdersPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Commerce Manager"]);

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; orders: StaffOrder[] }
  >({ status: "loading" });

  function load(query?: string) {
    fetchOrderCatalog(query)
      .then((orders) => setState({ status: "loaded", orders }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!canManage) {
      router.replace("/staff");
      return;
    }
    load();
  }, [canManage, router]);

  if (!canManage) return null;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    load(search || undefined);
  }

  function formatAmount(amount: string, currency: string) {
    const n = Number(amount);
    return Number.isNaN(n) ? `${amount} ${currency}` : `${n.toFixed(2)} ${currency}`;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Shopify &amp; Orders</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Real orders synced from Shopify, across every member. Read-only — Shopify stays the source of truth.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} strokeWidth={1.75} className="absolute top-1/2 left-3 -translate-y-1/2 text-cashmere-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, name, or email…"
            className="w-full rounded-lg border border-cashmere-border py-2 pr-3 pl-9 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-cashmere-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
        >
          Search
        </button>
      </form>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load orders ({state.message}).</p>
      )}

      {state.status === "loaded" && state.orders.length === 0 && (
        <div className="rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <p className="text-cashmere-text-muted">No orders match that search.</p>
        </div>
      )}

      {state.status === "loaded" && state.orders.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cashmere-border bg-cashmere-sidebar/60 text-xs uppercase tracking-wide text-cashmere-text-muted">
                <tr>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Order</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Member</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Amount</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Status</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Date</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cashmere-border">
                {state.orders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="cursor-pointer hover:bg-cashmere-sidebar/40"
                      >
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-cashmere-text">{order.orderNumber}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                          {order.member.firstName ?? "—"} {order.member.lastName ?? ""}
                          <span className="ml-1.5 text-xs text-cashmere-text-muted">
                            ({membershipTierLabel(order.member.membershipTier, order.member.isFoundingMember, order.member.region)})
                          </span>
                          <div className="text-xs text-cashmere-text-muted">{order.member.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                          {formatAmount(order.totalAmount, order.currency)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">{order.status}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                          {new Date(order.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                          {order.lineItems && order.lineItems.length > 0 ? (
                            isExpanded ? <ChevronUp size={16} strokeWidth={1.75} /> : <ChevronDown size={16} strokeWidth={1.75} />
                          ) : null}
                        </td>
                      </tr>
                      {isExpanded && order.lineItems && order.lineItems.length > 0 && (
                        <tr>
                          <td colSpan={6} className="bg-cashmere-sidebar/20 px-6 py-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">Line items</p>
                            <ul className="flex flex-col gap-1">
                              {order.lineItems.map((item, i) => (
                                <li key={i} className="flex justify-between text-sm text-cashmere-text">
                                  <span>
                                    {item.title}
                                    {item.variantTitle && <span className="text-cashmere-text-muted"> — {item.variantTitle}</span>}
                                    <span className="text-cashmere-text-muted"> × {item.quantity}</span>
                                  </span>
                                  <span className="text-cashmere-text-muted">{item.price}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
