"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchPendingDataRequests, completeDataRequest, StaffDataSubjectRequest } from "@/lib/staff-api";

// Member Support (or Super Administrator) only — mirrors the server-side
// @Roles('Member Support') guard on DataSubjectRequestsController. Deletion
// requests never appear here — those go straight through the customers/redact
// webhook (see api/src/webhooks/), this queue is ACCESS/EXPORT only.
export default function DataRequestsPage() {
  const staff = useStaff();
  const router = useRouter();
  const allowed = staffHasAnyRole(staff, ["Super Administrator", "Member Support"]);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; requests: StaffDataSubjectRequest[] }
  >({ status: "loading" });
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);

  function load() {
    fetchPendingDataRequests()
      .then((requests) => setState({ status: "loaded", requests }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!allowed) {
      router.replace("/staff");
      return;
    }
    load();
  }, [allowed, router]);

  if (!allowed) return null;

  async function handleComplete(id: string) {
    setCompletingId(id);
    try {
      await completeDataRequest(id, reasonById[id]);
      load();
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">GDPR Requests</h1>
        <p className="mt-1 text-cashmere-text-muted">Pending member data access requests, oldest first.</p>
      </div>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load pending requests ({state.message}).
        </p>
      )}

      {state.status === "loaded" && state.requests.length === 0 && (
        <div className="rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <p className="text-cashmere-text-muted">No pending requests. All caught up.</p>
        </div>
      )}

      {state.status === "loaded" &&
        state.requests.map((r) => (
          <div key={r.id} className="rounded-2xl border border-cashmere-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-cashmere-text">
                  {r.member.firstName ?? r.member.email} {r.member.lastName ?? ""}
                </p>
                <p className="text-sm text-cashmere-text-muted">{r.member.email}</p>
              </div>
              <span className="rounded-full bg-cashmere-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                {r.type}
              </span>
            </div>
            <p className="mt-2 text-xs text-cashmere-text-muted">
              Requested{" "}
              {new Date(r.requestedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>

            <div className="mt-3 flex flex-col gap-2 border-t border-cashmere-border pt-3 sm:flex-row sm:items-center">
              <input
                placeholder="Optional note (e.g. how the export was delivered)"
                value={reasonById[r.id] ?? ""}
                onChange={(e) => setReasonById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                className="flex-1 rounded-lg border border-cashmere-border px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => handleComplete(r.id)}
                disabled={completingId === r.id}
                className="rounded-full bg-cashmere-accent px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
              >
                {completingId === r.id ? "Completing…" : "Mark complete"}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
