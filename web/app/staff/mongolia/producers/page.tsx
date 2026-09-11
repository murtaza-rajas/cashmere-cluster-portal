"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchMongoliaProducerCatalog,
  createMongoliaProducer,
  updateMongoliaProducer,
  deleteMongoliaProducer,
  uploadMongoliaProducerImage,
  deleteMongoliaProducerImage,
  StaffMongoliaProducer,
  MongoliaProducerInput,
} from "@/lib/staff-api";

const EMPTY_PRODUCER_FORM: MongoliaProducerInput = {
  name: "",
  craft: "",
  location: "",
  story: "",
  foundingOnly: false,
  sortOrder: 0,
  active: true,
};

// Moved out of the old tabbed /staff/mongolia page (2026-09-11 restructure)
// into its own route — same component, just its own nav entry now.
export default function MongoliaProducersAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager", "Mongolia Editor"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffMongoliaProducer[] }
  >({ status: "loading" });
  const [form, setForm] = useState<MongoliaProducerInput>(EMPTY_PRODUCER_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function load() {
    fetchMongoliaProducerCatalog()
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

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_PRODUCER_FORM);
    setFormError(null);
  }

  function startEdit(row: StaffMongoliaProducer) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      craft: row.craft ?? "",
      location: row.location ?? "",
      story: row.story ?? "",
      foundingOnly: row.foundingOnly,
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
      const payload: MongoliaProducerInput = {
        ...form,
        craft: form.craft || undefined,
        location: form.location || undefined,
        story: form.story || undefined,
      };
      if (editingId) {
        await updateMongoliaProducer(editingId, payload);
      } else {
        await createMongoliaProducer(payload);
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
    await deleteMongoliaProducer(id);
    if (editingId === id) startCreate();
    load();
  }

  async function handleImageUpload(id: string, file: File) {
    setImageBusyId(id);
    try {
      await uploadMongoliaProducerImage(id, file);
      load();
    } finally {
      setImageBusyId(null);
    }
  }

  async function handleImageRemove(id: string) {
    setImageBusyId(id);
    try {
      await deleteMongoliaProducerImage(id);
      load();
    } finally {
      setImageBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Producers</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Mongolia producer profiles. Founding-only profiles are hidden from Mongolia Newsletter.
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit producer" : "Add producer"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Story</label>
            <textarea
              value={form.story}
              onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Craft</label>
              <input
                value={form.craft}
                onChange={(e) => setForm((f) => ({ ...f, craft: e.target.value }))}
                placeholder="e.g. Cashmere herding, Weaving"
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Ömnögovi Province"
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-2 sm:col-span-2">
              <label className="flex items-center gap-1.5 text-sm text-cashmere-text">
                <input
                  type="checkbox"
                  checked={form.foundingOnly}
                  onChange={(e) => setForm((f) => ({ ...f, foundingOnly: e.target.checked }))}
                />
                Founding Member only
              </label>
              <label className="flex items-center gap-1.5 text-sm text-cashmere-text">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </section>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load producers ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-3">
          {state.rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No producers yet — add one above.
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
                  <p className="font-medium text-cashmere-text">{row.name}</p>
                  {!row.active && <span className="text-xs text-red-600">(inactive)</span>}
                  {row.foundingOnly && (
                    <span className="rounded-full bg-cashmere-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cashmere-navy">
                      Founding only
                    </span>
                  )}
                </div>
                {row.craft && <p className="mt-1 text-sm text-cashmere-text-muted">{row.craft}</p>}
                {row.location && <p className="mt-1 text-xs text-cashmere-text-muted">{row.location}</p>}

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
                  aria-label={`Edit ${row.name}`}
                  className="rounded-full border border-cashmere-border p-2 text-cashmere-text transition-colors hover:border-cashmere-accent"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  aria-label={`Delete ${row.name}`}
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
