"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchCareGuideCatalog, updateCareGuide, StaffCareGuide, CareGuideTopic } from "@/lib/staff-api";

// Topic labels match the client's own confirmed list, same wording already
// shown on the member-facing page (app/(member)/care-repair/page.tsx) — this
// admin screen only edits each topic's guide text, it doesn't add/remove
// topics (see care-guides.service.ts's comment on why that's fixed).
const TOPIC_LABELS: Record<CareGuideTopic, string> = {
  WASHING: "Washing & Cleaning",
  STORAGE: "Storage",
  PILLING: "Pilling",
  REPAIRS: "Simple Repairs",
  LONGEVITY: "Longevity",
};
const TOPIC_ORDER: CareGuideTopic[] = ["WASHING", "STORAGE", "PILLING", "REPAIRS", "LONGEVITY"];

// Content Manager per the seeded role description, which names "Care &
// Repair guides" explicitly — server-side already enforces this on every
// /care-guide-catalog endpoint, this is just the matching UI guard.
export default function CareRepairAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffCareGuide[] }
  >({ status: "loading" });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingTopic, setSavingTopic] = useState<CareGuideTopic | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchCareGuideCatalog()
      .then((rows) => {
        setState({ status: "loaded", rows });
        setDrafts(Object.fromEntries(rows.map((r) => [r.topic, r.body ?? ""])));
      })
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

  async function handleSave(topic: CareGuideTopic) {
    setSavingTopic(topic);
    setError(null);
    try {
      await updateCareGuide(topic, drafts[topic] ?? "");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTopic(null);
    }
  }

  const rowsByTopic = new Map((state.status === "loaded" ? state.rows : []).map((r) => [r.topic, r]));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Care &amp; Repair</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Guide text shown on members&apos; Care &amp; Repair page. Topics are fixed; leave a topic blank to keep
          showing &quot;Guide coming soon&quot;.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load guides ({state.message}).</p>
      )}

      {state.status === "loaded" &&
        TOPIC_ORDER.map((topic) => {
          const row = rowsByTopic.get(topic);
          const hasContent = !!row?.body;
          return (
            <section key={topic} className="rounded-2xl border border-cashmere-border bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-cashmere-text">{TOPIC_LABELS[topic]}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    hasContent ? "bg-green-100 text-green-700" : "bg-cashmere-sidebar text-cashmere-text-muted"
                  }`}
                >
                  {hasContent ? "Published" : "Coming soon"}
                </span>
              </div>
              <textarea
                value={drafts[topic] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [topic]: e.target.value }))}
                rows={4}
                placeholder="Guide text shown to members…"
                className="mt-3 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => handleSave(topic)}
                  disabled={savingTopic === topic}
                  className="rounded-full bg-cashmere-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
                >
                  {savingTopic === topic ? "Saving…" : "Save"}
                </button>
              </div>
            </section>
          );
        })}
    </div>
  );
}
