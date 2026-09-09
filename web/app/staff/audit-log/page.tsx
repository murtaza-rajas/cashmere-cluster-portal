"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchAuditLog, fetchAuditLogActions, AuditLogEntry, AuditLogFilters } from "@/lib/staff-api";

const PAGE_SIZE = 25;

// Super Administrator only, same as Staff & Roles — server-side already
// enforces this on /audit-log, this is just the matching UI guard.
export default function AuditLogPage() {
  const staff = useStaff();
  const router = useRouter();
  const canView = staffHasAnyRole(staff, ["Super Administrator"]);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; items: AuditLogEntry[]; total: number }
  >({ status: "loading" });
  const [actions, setActions] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ action: string; targetType: string; from: string; to: string }>({
    action: "",
    targetType: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);

  function load() {
    const query: AuditLogFilters = { page, pageSize: PAGE_SIZE };
    if (filters.action) query.action = filters.action;
    if (filters.targetType) query.targetType = filters.targetType;
    if (filters.from) query.from = filters.from;
    if (filters.to) query.to = filters.to;
    fetchAuditLog(query)
      .then((res) => setState({ status: "loaded", items: res.items, total: res.total }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!canView) {
      router.replace("/staff");
      return;
    }
    fetchAuditLogActions().then(setActions).catch(() => undefined);
  }, [canView, router]);

  useEffect(() => {
    if (!canView) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page]);

  if (!canView) return null;

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function targetLabel(entry: AuditLogEntry): string {
    if (entry.targetMember) {
      const name = [entry.targetMember.firstName, entry.targetMember.lastName].filter(Boolean).join(" ");
      return `${entry.targetType} — ${name || entry.targetMember.email}`;
    }
    return `${entry.targetType} — ${entry.targetId}`;
  }

  const totalPages = state.status === "loaded" ? Math.max(1, Math.ceil(state.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Audit Log</h1>
        <p className="mt-1 text-cashmere-text-muted">Every sensitive administrative action, most recent first.</p>
      </div>

      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 rounded-2xl border border-cashmere-border bg-white p-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            className="mt-1 rounded-lg border border-cashmere-border px-3 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Target type</label>
          <input
            value={filters.targetType}
            onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
            placeholder="e.g. Member"
            className="mt-1 w-32 rounded-lg border border-cashmere-border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="mt-1 rounded-lg border border-cashmere-border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="mt-1 rounded-lg border border-cashmere-border px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-cashmere-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
        >
          Filter
        </button>
      </form>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load the audit log ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-cashmere-border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-cashmere-border text-xs uppercase tracking-wide text-cashmere-text-muted">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {state.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-cashmere-text-muted">
                      No matching entries.
                    </td>
                  </tr>
                )}
                {state.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-cashmere-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-cashmere-text-muted">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-cashmere-text">{entry.actorStaffUser?.name ?? "System"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-cashmere-text">{entry.action}</td>
                    <td className="px-4 py-3 text-cashmere-text-muted">{targetLabel(entry)}</td>
                    <td className="px-4 py-3 text-cashmere-text-muted">{entry.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-cashmere-text-muted">
            <p>
              {state.total === 0 ? "0 entries" : `Page ${page} of ${totalPages} — ${state.total} total`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-full border border-cashmere-border px-4 py-1.5 font-medium text-cashmere-text transition-colors hover:border-cashmere-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-full border border-cashmere-border px-4 py-1.5 font-medium text-cashmere-text transition-colors hover:border-cashmere-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
