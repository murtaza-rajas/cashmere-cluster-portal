"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMemberDetail, MemberDetail } from "@/lib/staff-api";
import { formatMemberId, formatMonthYear, membershipTierLabel } from "@/lib/api";

// The staff-facing combined snapshot (profile + orders + collection + wishlist)
// — a read-only view, no edit actions yet (member edit/tier-change isn't built
// on either side, backend or frontend).
export default function StaffMemberDetailPage() {
  const staff = useStaff();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const allowed = staffHasAnyRole(staff, ["Club Manager", "Member Support"]);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; detail: MemberDetail }
  >({ status: "loading" });

  useEffect(() => {
    if (!allowed) {
      router.replace("/staff");
      return;
    }
    fetchMemberDetail(params.id)
      .then((detail) => setState({ status: "loaded", detail }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [allowed, router, params.id]);

  if (!allowed) return null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/staff/members" className="flex w-fit items-center gap-1 text-sm text-cashmere-text-muted hover:text-cashmere-text">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Back to Members &amp; Users
      </Link>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load this member ({state.message}).
        </p>
      )}

      {state.status === "loaded" && (
        <>
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">
              {state.detail.member.firstName ?? state.detail.member.email} {state.detail.member.lastName ?? ""}
            </h1>
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-cashmere-accent">
              {membershipTierLabel(
                state.detail.member.membershipTier,
                state.detail.member.isFoundingMember,
                state.detail.member.region,
              )}
            </p>
          </div>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Profile</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" value={state.detail.member.email} />
              <Field label="Member ID" value={formatMemberId(state.detail.member.id)} />
              <Field label="Member since" value={formatMonthYear(state.detail.member.createdAt)} />
              <Field label="Region" value={state.detail.member.region} />
              <Field label="Language" value={state.detail.member.language} />
              <Field label="Status" value={state.detail.member.membershipStatus} />
            </dl>
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
              Orders ({state.detail.orders.length})
            </h2>
            {state.detail.orders.length === 0 ? (
              <p className="mt-2 text-sm text-cashmere-text-muted">No orders yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {state.detail.orders.map((o) => (
                  <li key={o.id} className="flex justify-between border-b border-cashmere-border pb-2 last:border-0">
                    <span className="text-cashmere-text">{o.orderNumber}</span>
                    <span className="text-cashmere-text-muted">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: o.currency }).format(
                        Number(o.totalAmount),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
              Collection ({state.detail.collection.length})
            </h2>
            {state.detail.collection.length === 0 ? (
              <p className="mt-2 text-sm text-cashmere-text-muted">No pieces yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1 text-sm text-cashmere-text">
                {state.detail.collection.map((item, i) => (
                  <li key={i}>
                    {item.title}
                    {item.variantTitle ? ` — ${item.variantTitle}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
              Wishlist ({state.detail.wishlist.length})
            </h2>
            {state.detail.wishlist.length === 0 ? (
              <p className="mt-2 text-sm text-cashmere-text-muted">Empty.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1 text-sm text-cashmere-text">
                {state.detail.wishlist.map((item) => (
                  <li key={item.id}>
                    {item.title}
                    {item.variantTitle ? ` — ${item.variantTitle}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-cashmere-text">{value}</dd>
    </div>
  );
}
