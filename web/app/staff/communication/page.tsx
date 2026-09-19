"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchNewsletterCampaigns,
  createNewsletterCampaign,
  updateNewsletterCampaign,
  deleteNewsletterCampaign,
  StaffNewsletterCampaign,
  NewsletterCampaignInput,
} from "@/lib/staff-api";

const TIERS: NewsletterCampaignInput["audienceTiers"][number][] = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"];

const EMPTY_FORM: NewsletterCampaignInput = {
  subject: "",
  body: "",
  audienceTiers: [],
  scheduledFor: "",
  status: "DRAFT",
};

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// Newsletter Manager per the seeded role description ("audiences, campaigns,
// schedules, statistics") — server-side already enforces this on every
// /newsletter-campaigns endpoint, this is just the matching UI guard.
//
// Deliberately no "Send" action anywhere on this page: there is no
// Mailchimp API access yet (see PROJECT_TRACKER.md's blocker list), so a
// campaign only ever reaches "Ready to send" — same honest-placeholder
// split already used for Mailchimp on /staff/integrations. Taking a
// ready campaign out to Mailchimp is a manual step for now.
export default function CommunicationAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Newsletter Manager"]);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; rows: StaffNewsletterCampaign[] }
  >({ status: "loading" });
  const [form, setForm] = useState<NewsletterCampaignInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    fetchNewsletterCampaigns()
      .then((rows) => setState({ status: "loaded", rows }))
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

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function startEdit(row: StaffNewsletterCampaign) {
    setEditingId(row.id);
    setForm({
      subject: row.subject,
      body: row.body ?? "",
      audienceTiers: row.audienceTiers,
      scheduledFor: toDateInputValue(row.scheduledFor),
      status: row.status,
    });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const dto: NewsletterCampaignInput = {
        ...form,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
      };
      if (editingId) {
        await updateNewsletterCampaign(editingId, dto);
      } else {
        await createNewsletterCampaign(dto);
      }
      startCreate();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteNewsletterCampaign(id);
    if (editingId === id) startCreate();
    load();
  }

  function toggleTier(tier: NewsletterCampaignInput["audienceTiers"][number]) {
    setForm((prev) => ({
      ...prev,
      audienceTiers: prev.audienceTiers.includes(tier)
        ? prev.audienceTiers.filter((t) => t !== tier)
        : [...prev.audienceTiers, tier],
    }));
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Communication</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Draft newsletter campaigns and their intended audience ahead of sending.
        </p>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Mailchimp isn&apos;t connected yet (see Integrations &amp; Settings), so campaigns drafted here can&apos;t be
        sent from this page — mark a campaign &quot;Ready to send&quot;, then export the subject/body/audience and
        send it via Mailchimp directly.
      </section>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit campaign" : "Draft a campaign"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Subject</label>
            <input
              required
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={5}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">
              Audience (none selected = draft, not targeted yet)
            </label>
            <div className="mt-1 flex flex-wrap gap-3">
              {TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-1.5 text-sm text-cashmere-text">
                  <input
                    type="checkbox"
                    checked={form.audienceTiers.includes(tier)}
                    onChange={() => toggleTier(tier)}
                  />
                  {tier}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Intended send date</label>
              <input
                type="date"
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                className="mt-1 rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as NewsletterCampaignInput["status"] }))
                }
                className="mt-1 rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="READY_TO_SEND">Ready to send</option>
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="rounded-full border border-cashmere-border px-5 py-2.5 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-1 rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
              >
                {!editingId && <Plus size={16} strokeWidth={2} />}
                {saving ? "Saving…" : editingId ? "Save changes" : "Add"}
              </button>
            </div>
          </div>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </section>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load campaigns ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-3">
          {state.rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No campaigns yet — draft one above.
            </p>
          )}
          {state.rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-cashmere-border bg-white p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-cashmere-text">{row.subject}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      row.status === "READY_TO_SEND"
                        ? "bg-green-100 text-green-700"
                        : "bg-cashmere-sidebar text-cashmere-text-muted"
                    }`}
                  >
                    {row.status === "READY_TO_SEND" ? "Ready to send" : "Draft"}
                  </span>
                </div>
                {row.scheduledFor && (
                  <p className="mt-1 text-sm text-cashmere-text-muted">
                    Intended for {new Date(row.scheduledFor).toLocaleDateString()}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.audienceTiers.length === 0 && (
                    <span className="text-xs text-cashmere-text-muted">No audience (draft)</span>
                  )}
                  {row.audienceTiers.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-cashmere-accent/10 px-2.5 py-1 text-xs font-medium text-cashmere-accent-dark"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(row)}
                  aria-label={`Edit ${row.subject}`}
                  className="rounded-full border border-cashmere-border p-2 text-cashmere-text transition-colors hover:border-cashmere-accent"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  aria-label={`Delete ${row.subject}`}
                  className="rounded-full border border-cashmere-border p-2 text-cashmere-text transition-colors hover:border-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
