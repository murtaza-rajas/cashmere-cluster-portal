"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { fetchMemberOrders, MemberOrder } from "@/lib/api";

// No mockup exists for this page yet (see PROJECT_TRACKER.md Section 7) — matches
// the visual style of Dashboard/Profile. MemberOrderCache (schema.prisma) is a
// read-only cache kept in sync via a Shopify order webhook that isn't built yet
// (Milestone 4), so every member legitimately has zero orders until then — the
// empty state below is the honest, expected state for now, not a bug.
export default function OrdersPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; orders: MemberOrder[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchMemberOrders()
      .then((orders) => setState({ status: "loaded", orders }))
      .catch((err: Error) =>
        setState({ status: "error", message: err.message }),
      );
  }, []);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-cashmere-text">
        My Orders
      </h1>

      {state.status === "loading" && (
        <p className="text-cashmere-text-muted">Loading your orders…</p>
      )}

      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your orders ({state.message}). Try refreshing the page.
        </p>
      )}

      {state.status === "loaded" && state.orders.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <Package
            size={28}
            strokeWidth={1.5}
            className="text-cashmere-text-muted"
          />
          <p className="font-medium text-cashmere-text">No orders yet</p>
          <p className="max-w-sm text-sm text-cashmere-text-muted">
            Purchases made on CashmereHouse.com will appear here once placed.
          </p>
        </div>
      )}

      {state.status === "loaded" && state.orders.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cashmere-border bg-cashmere-sidebar/60 text-xs uppercase tracking-wide text-cashmere-text-muted">
                <tr>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">
                    Order
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">
                    Date
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cashmere-border">
                {state.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-cashmere-text">
                      {order.orderNumber}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                      {new Date(order.orderDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                      {order.status}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-cashmere-text">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: order.currency,
                      }).format(Number(order.totalAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
