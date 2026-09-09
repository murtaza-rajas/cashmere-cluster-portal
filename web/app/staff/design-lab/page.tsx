"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchDesignCatalog,
  createDesign,
  updateDesign,
  deleteDesign,
  uploadDesignImage,
  deleteDesignImage,
  StaffDesign,
  DesignInput,
  DesignStatus,
  DesignImageSlot,
} from "@/lib/staff-api";

const STATUS_OPTIONS: { value: DesignStatus; label: string }[] = [
  { value: "CURRENT", label: "Current" },
  { value: "SELECTED_FOR_PRODUCTION", label: "Selected for Production" },
  { value: "PAST_ROUND", label: "Past Round" },
];

const IMAGE_SLOTS: { slot: DesignImageSlot; label: string }[] = [
  { slot: "hero", label: "Hero photo" },
  { slot: "swatch", label: "Fabric swatch" },
  { slot: "sketch", label: "Sketch" },
];

const EMPTY_FORM: DesignInput = {
  title: "",
  description: "",
  round: "",
  status: "CURRENT",
  tags: [],
  sortOrder: 0,
  active: true,
};

// Content Manager — see designs.controller.ts's comment on why it's the
// closest fit among the 10 seeded roles rather than a role invented for
// this feature.
export default function DesignLabAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffDesign[] }
  >({ status: "loading" });
  const [form, setForm] = useState<DesignInput>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageBusyKey, setImageBusyKey] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function load() {
    fetchDesignCatalog()
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
    setTagsText("");
    setFormError(null);
  }

  function startEdit(row: StaffDesign) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description ?? "",
      round: row.round ?? "",
      status: row.status,
      tags: row.tags,
      sortOrder: row.sortOrder,
      active: row.active,
    });
    setTagsText(row.tags.join(", "));
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Same empty-string-becomes-undefined handling as Events — @IsOptional()
      // only skips validation for undefined/null, not "".
      const payload: DesignInput = {
        ...form,
        description: form.description || undefined,
        round: form.round || undefined,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (editingId) {
        await updateDesign(editingId, payload);
      } else {
        await createDesign(payload);
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
    await deleteDesign(id);
    if (editingId === id) startCreate();
    load();
  }

  async function handleImageUpload(id: string, slot: DesignImageSlot, file: File) {
    const key = `${id}-${slot}`;
    setImageBusyKey(key);
    try {
      await uploadDesignImage(id, slot, file);
      load();
    } finally {
      setImageBusyKey(null);
    }
  }

  async function handleImageRemove(id: string, slot: DesignImageSlot) {
    const key = `${id}-${slot}`;
    setImageBusyKey(key);
    try {
      await deleteDesignImage(id, slot);
      load();
    } finally {
      setImageBusyKey(null);
    }
  }

  const imageUrlForSlot = (row: StaffDesign, slot: DesignImageSlot) =>
    slot === "hero" ? row.heroImageUrl : slot === "swatch" ? row.swatchImageUrl : row.sketchImageUrl;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Founders&apos; Design Lab</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Designs Founding Members can browse, save and vote on — Annual Members get a preview (view + save, no
          voting). International portal only.
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit design" : "Add design"}
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
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DesignStatus }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Round / season</label>
              <input
                value={form.round}
                onChange={(e) => setForm((f) => ({ ...f, round: e.target.value }))}
                placeholder="e.g. Spring 2027"
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Tags (comma-separated)</label>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Lightweight, Everyday, Versatile"
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end gap-4">
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
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load designs ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-3">
          {state.rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No designs yet — add one above.
            </p>
          )}
          {state.rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-4 rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-cashmere-text">{row.title}</p>
                    {!row.active && <span className="text-xs text-red-600">(inactive)</span>}
                  </div>
                  {row.description && <p className="mt-1 text-sm text-cashmere-text-muted">{row.description}</p>}
                  <p className="mt-1 text-xs text-cashmere-text-muted">
                    {STATUS_OPTIONS.find((o) => o.value === row.status)?.label}
                    {row.round ? ` · ${row.round}` : ""}
                  </p>
                  {row.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-cashmere-accent/10 px-2.5 py-1 text-xs font-medium text-cashmere-accent-dark"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {IMAGE_SLOTS.map(({ slot, label }) => {
                  const url = imageUrlForSlot(row, slot);
                  const key = `${row.id}-${slot}`;
                  return (
                    <div key={slot} className="flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-wide text-cashmere-text-muted">{label}</p>
                      <div className="relative h-28 w-full overflow-hidden rounded-lg bg-cashmere-sidebar/60">
                        {url ? (
                          <Image src={url} alt="" fill className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-cashmere-text-muted">
                            No photo
                          </div>
                        )}
                      </div>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[key] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(row.id, slot, file);
                          e.target.value = "";
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={imageBusyKey === key}
                          onClick={() => fileInputRefs.current[key]?.click()}
                          className="flex flex-1 items-center justify-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text transition-colors hover:border-cashmere-accent disabled:opacity-60"
                        >
                          <Upload size={12} strokeWidth={2} />
                          {imageBusyKey === key ? "Working…" : url ? "Replace" : "Upload"}
                        </button>
                        {url && (
                          <button
                            type="button"
                            disabled={imageBusyKey === key}
                            onClick={() => handleImageRemove(row.id, slot)}
                            className="text-xs font-medium text-cashmere-text-muted hover:text-red-600 disabled:opacity-60"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
