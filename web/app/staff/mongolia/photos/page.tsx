"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Images, Check, X, Trash2 } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMongoliaPhotoCatalog, reviewMongoliaPhoto, deleteMongoliaPhoto, StaffMongoliaPhoto } from "@/lib/staff-api";

const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

// Photo Archive moderation — real submission + review queue (2026-09-09
// email: "submitted images are not published automatically... full admin
// control"), same pending/approved/rejected review shape as the GDPR
// requests queue, not a new pattern invented for this. No create form here
// — photos only ever come from a member's own submission.
export default function MongoliaPhotoArchivePage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager", "Mongolia Editor"]);

  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffMongoliaPhoto[] }
  >({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [foundingOnlyById, setFoundingOnlyById] = useState<Record<string, boolean>>({});

  function load() {
    fetchMongoliaPhotoCatalog()
      .then((rows) => setState({ status: "loaded", rows }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!canManage) {
      router.replace("/staff/mongolia");
      return;
    }
    load();
  }, [canManage, router]);

  if (!canManage) return null;

  async function handleApprove(row: StaffMongoliaPhoto) {
    setBusyId(row.id);
    try {
      await reviewMongoliaPhoto(row.id, { status: "APPROVED", foundingOnly: foundingOnlyById[row.id] ?? false });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(row: StaffMongoliaPhoto) {
    setBusyId(row.id);
    try {
      await reviewMongoliaPhoto(row.id, { status: "REJECTED" });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteMongoliaPhoto(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  const rows = state.status === "loaded" ? state.rows.filter((r) => r.status === tab) : [];
  const pendingCount = state.status === "loaded" ? state.rows.filter((r) => r.status === "PENDING").length : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Photo Archive</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Member-submitted photos from across Mongolia. Nothing is published until you approve it.
        </p>
      </div>

      <div className="flex gap-2 border-b border-cashmere-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-cashmere-accent text-cashmere-text" : "text-cashmere-text-muted hover:text-cashmere-text"
            }`}
          >
            {t === "PENDING" ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` : t === "APPROVED" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load photos ({state.message}).</p>
      )}

      {state.status === "loaded" && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <Images size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <p className="font-medium text-cashmere-text">Nothing here</p>
          <p className="max-w-sm text-sm text-cashmere-text-muted">
            {tab === "PENDING" ? "No submissions waiting for review." : `No ${tab.toLowerCase()} photos yet.`}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="relative h-40 overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                <Image src={row.imageUrl} alt="" fill className="object-cover" />
              </div>
              <div>
                {row.caption && <p className="text-sm text-cashmere-text">{row.caption}</p>}
                <p className="mt-1 text-xs text-cashmere-text-muted">
                  {row.submittedBy.firstName ?? row.submittedBy.email} · {new Date(row.createdAt).toLocaleDateString()}
                </p>
                {row.status === "APPROVED" && row.foundingOnly && (
                  <span className="mt-1 inline-block rounded-full bg-cashmere-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cashmere-navy">
                    Founding only
                  </span>
                )}
                {row.reviewNote && <p className="mt-1 text-xs text-cashmere-text-muted">Note: {row.reviewNote}</p>}
              </div>

              {row.status === "PENDING" && (
                <div className="flex flex-col gap-2 border-t border-cashmere-border pt-3">
                  <label className="flex items-center gap-1.5 text-xs text-cashmere-text">
                    <input
                      type="checkbox"
                      checked={foundingOnlyById[row.id] ?? false}
                      onChange={(e) => setFoundingOnlyById((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                    />
                    Founding Member only when approved
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => handleApprove(row)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-full bg-cashmere-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
                    >
                      <Check size={14} strokeWidth={2} />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => handleReject(row)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-60"
                    >
                      <X size={14} strokeWidth={2} />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {row.status !== "PENDING" && (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => handleDelete(row.id)}
                  className="flex items-center justify-center gap-1 self-start rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text-muted transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-60"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                  Delete
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
