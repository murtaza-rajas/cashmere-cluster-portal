"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchStoryCatalog,
  createStory,
  updateStory,
  deleteStory,
  uploadStoryImage,
  deleteStoryImage,
  StaffStory,
  StoryInput,
} from "@/lib/staff-api";

const TIERS: StoryInput["tiers"][number][] = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"];

const EMPTY_FORM: StoryInput = {
  title: "",
  body: "",
  quote: "",
  category: "",
  tiers: [],
  sortOrder: 0,
  active: true,
};

// Content Manager per the seeded role description ("Editorial content:
// stories, news, videos, Care & Repair guides.") — server-side already
// enforces this on every /story-catalog endpoint, this is just the matching
// UI guard. Replaces the honest "coming soon" placeholder members previously
// saw at /news.
export default function StoriesAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffStory[] }
  >({ status: "loading" });
  const [form, setForm] = useState<StoryInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function load() {
    fetchStoryCatalog()
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

  function startEdit(row: StaffStory) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      body: row.body ?? "",
      quote: row.quote ?? "",
      category: row.category ?? "",
      tiers: row.tiers,
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
      const payload: StoryInput = {
        ...form,
        body: form.body || undefined,
        quote: form.quote || undefined,
        category: form.category || undefined,
      };
      if (editingId) {
        await updateStory(editingId, payload);
      } else {
        await createStory(payload);
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
    await deleteStory(id);
    if (editingId === id) startCreate();
    load();
  }

  async function handleImageUpload(id: string, file: File) {
    setImageBusyId(id);
    try {
      await uploadStoryImage(id, file);
      load();
    } finally {
      setImageBusyId(null);
    }
  }

  async function handleImageRemove(id: string) {
    setImageBusyId(id);
    try {
      await deleteStoryImage(id);
      load();
    } finally {
      setImageBusyId(null);
    }
  }

  function toggleTier(tier: StoryInput["tiers"][number]) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.includes(tier) ? prev.tiers.filter((t) => t !== tier) : [...prev.tiers, tier],
    }));
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Stories &amp; Knowledge</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Club news and stories shown on members&apos; Stories &amp; Knowledge page, scoped per tier. A story visible
          to every tier (including Newsletter) is the public story Newsletter/Mongolia members see.
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit story" : "Add story"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
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
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={5}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Pull quote</label>
              <input
                value={form.quote}
                onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Club News, Producer Story, Designer Spotlight…"
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">
              Visible to tiers (none selected = draft, visible to nobody)
            </label>
            <div className="mt-1 flex flex-wrap gap-3">
              {TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-1.5 text-sm text-cashmere-text">
                  <input type="checkbox" checked={form.tiers.includes(tier)} onChange={() => toggleTier(tier)} />
                  {tier}
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
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load stories ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-3">
          {state.rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No stories yet — add one above.
            </p>
          )}
          {state.rows.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-4 rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-cashmere-sidebar/60">
                {row.heroImageUrl ? (
                  <Image src={row.heroImageUrl} alt="" fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-cashmere-text-muted">
                    No photo
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-cashmere-text">{row.title}</p>
                  {!row.active && <span className="text-xs text-red-600">(inactive)</span>}
                </div>
                {row.category && <p className="mt-1 text-xs text-cashmere-text-muted">{row.category}</p>}
                {row.body && <p className="mt-1 line-clamp-2 text-sm text-cashmere-text-muted">{row.body}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.tiers.length === 0 && <span className="text-xs text-cashmere-text-muted">No tiers (draft)</span>}
                  {row.tiers.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-cashmere-accent/10 px-2.5 py-1 text-xs font-medium text-cashmere-accent-dark"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      fileInputRefs.current[row.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(row.id, file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={imageBusyId === row.id}
                    onClick={() => fileInputRefs.current[row.id]?.click()}
                    className="flex items-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text transition-colors hover:border-cashmere-accent disabled:opacity-60"
                  >
                    <Upload size={12} strokeWidth={2} />
                    {imageBusyId === row.id ? "Working…" : row.heroImageUrl ? "Replace photo" : "Upload photo"}
                  </button>
                  {row.heroImageUrl && (
                    <button
                      type="button"
                      disabled={imageBusyId === row.id}
                      onClick={() => handleImageRemove(row.id)}
                      className="text-xs font-medium text-cashmere-text-muted hover:text-red-600 disabled:opacity-60"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
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
