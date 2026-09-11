"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchBenefitCatalog, createBenefit, updateBenefit, deleteBenefit, StaffBenefit, BenefitInput } from "@/lib/staff-api";
import { BENEFIT_ICONS } from "@/lib/benefit-icons";

const ICON_KEYS = Object.keys(BENEFIT_ICONS);

// The two real Mongolia levels — same reasoning as the Mongolia Events
// page. Per the client's own confirmed content list (2026-09-09 email),
// Mongolia-specific member offers are named under Founding Member's full
// access only, not Newsletter's — so this defaults to Founding, but stays
// a real checkbox (not hardcoded) in case that changes.
const MONGOLIA_TIERS: BenefitInput["tiers"] = ["MONGOLIA", "NEWSLETTER"];

const EMPTY_FORM: BenefitInput = {
  type: "OFFER",
  tiers: ["MONGOLIA"],
  icon: ICON_KEYS[0],
  title: "",
  description: "",
  sortOrder: 0,
  active: true,
};

// Current Offers (Mongolia) — client's explicit instruction (2026-09-11):
// same underlying admin logic as the international CLC sections. No
// separate Mongolia offer model — this is the exact same Benefit model +
// /benefit-catalog backend as /staff/benefits (type OFFER), just a
// Mongolia-filtered view with the tier pre-selected, and — deliberately
// unchanged — the exact same Club Manager role gate as the international
// page. `regions` is always fixed to Mongolia here (see schema.prisma's
// comment on Benefit.regions for why tier alone isn't enough).
export default function MongoliaOffersAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Club Manager", "Mongolia Editor"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffBenefit[] }
  >({ status: "loading" });
  const [form, setForm] = useState<BenefitInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    fetchBenefitCatalog("OFFER")
      .then((rows) => setState({ status: "loaded", rows: rows.filter((r) => r.regions.includes("MONGOLIA")) }))
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

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function startEdit(row: StaffBenefit) {
    setEditingId(row.id);
    setForm({
      type: "OFFER",
      tiers: row.tiers,
      icon: row.icon ?? ICON_KEYS[0],
      title: row.title,
      description: row.description ?? "",
      sortOrder: row.sortOrder,
      active: row.active,
    });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Always Mongolia — this page only ever creates/edits Mongolia offers.
      const payload: BenefitInput = { ...form, regions: ["MONGOLIA"] };
      if (editingId) {
        await updateBenefit(editingId, payload);
      } else {
        await createBenefit(payload);
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
    await deleteBenefit(id);
    if (editingId === id) startCreate();
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Current Offers</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Offers shown to Mongolia members — never automatically inherits international Founding/Annual offers.
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit offer" : "Add offer"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Icon</label>
              <select
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              >
                {ICON_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">
              Visible to (none selected = draft, visible to nobody)
            </label>
            <div className="mt-1 flex flex-wrap gap-3">
              {MONGOLIA_TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-1.5 text-sm text-cashmere-text">
                  <input
                    type="checkbox"
                    checked={form.tiers.includes(tier)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        tiers: f.tiers.includes(tier) ? f.tiers.filter((t) => t !== tier) : [...f.tiers, tier],
                      }))
                    }
                  />
                  {tier === "MONGOLIA" ? "Mongolia Founding Member" : "Mongolia Newsletter"}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="mt-1 w-24 rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-cashmere-text">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>

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
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load offers ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-3">
          {state.rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No Mongolia offers yet — add one above.
            </p>
          )}
          {state.rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-cashmere-border bg-white p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-cashmere-text">{row.title}</p>
                  {!row.active && <span className="text-xs text-red-600">(inactive)</span>}
                </div>
                {row.description && <p className="mt-1 text-sm text-cashmere-text-muted">{row.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.tiers.map((t) => (
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
                  aria-label={`Edit ${row.title}`}
                  className="rounded-full border border-cashmere-border p-2 text-cashmere-text transition-colors hover:border-cashmere-accent"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  aria-label={`Delete ${row.title}`}
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
