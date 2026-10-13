"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchHomepageUpdateCatalog,
  createHomepageUpdate,
  updateHomepageUpdate,
  deleteHomepageUpdate,
  uploadHomepageUpdateImage,
  fetchStoryCatalog,
  StaffHomepageUpdate,
  HomepageUpdateInput,
  StaffStory,
} from "@/lib/staff-api";

type Tier = HomepageUpdateInput["tiers"][number];
const TIERS: { value: Tier; label: string }[] = [
  { value: "NEWSLETTER", label: "Newsletter" },
  { value: "SIX_MONTH", label: "6-Month" },
  { value: "ANNUAL", label: "Annual" },
  { value: "FOUNDING", label: "Founding" },
];

const EMPTY_FORM: HomepageUpdateInput = {
  label: "CLC Update",
  title: "",
  summary: "",
  displayDate: new Date().toISOString().slice(0, 10),
  storyId: null,
  tiers: ["NEWSLETTER", "SIX_MONTH", "ANNUAL", "FOUNDING"],
  active: true,
};

// "CLC Update" banner on the member homepages. The newest active banner for a
// member's level is the one shown; "Read the update" opens the linked
// Stories & Knowledge article. Content Manager, enforced server-side too.
export default function ClcUpdateAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);

  const [rows, setRows] = useState<StaffHomepageUpdate[] | null>(null);
  const [stories, setStories] = useState<StaffStory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<HomepageUpdateInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function load() {
    fetchHomepageUpdateCatalog()
      .then(setRows)
      .catch((err: Error) => setLoadError(err.message));
  }

  useEffect(() => {
    if (!canManage) {
      router.replace("/staff");
      return;
    }
    load();
    fetchStoryCatalog()
      .then(setStories)
      .catch(() => setStories([]));
  }, [canManage, router]);

  if (!canManage) return null;

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function startEdit(row: StaffHomepageUpdate) {
    setEditingId(row.id);
    setForm({
      label: row.label,
      title: row.title,
      summary: row.summary,
      displayDate: row.displayDate ? row.displayDate.slice(0, 10) : null,
      storyId: row.storyId,
      tiers: row.tiers,
      active: row.active,
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload: HomepageUpdateInput = {
        ...form,
        displayDate: form.displayDate || null,
        storyId: form.storyId || null,
      };
      if (editingId) {
        await updateHomepageUpdate(editingId, payload);
      } else {
        // A new banner can't carry null optional fields on create.
        await createHomepageUpdate({
          ...payload,
          displayDate: payload.displayDate ?? undefined,
          storyId: payload.storyId ?? undefined,
        });
      }
      startCreate();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: StaffHomepageUpdate) {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    await deleteHomepageUpdate(row.id);
    if (editingId === row.id) startCreate();
    load();
  }

  async function handleImageUpload(id: string, file: File) {
    setImageBusyId(id);
    try {
      await uploadHomepageUpdateImage(id, file);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setImageBusyId(null);
    }
  }

  function toggleTier(tier: Tier) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.includes(tier) ? prev.tiers.filter((t) => t !== tier) : [...prev.tiers, tier],
    }));
  }

  const inputClass = "mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm";
  const labelClass = "text-xs uppercase tracking-wide text-cashmere-text-muted";

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">CLC Update</h1>
        <p className="mt-1 text-cashmere-text-muted">
          The update banner on members&apos; homepages. The newest active banner for each level is shown; its button
          opens the article you choose (write the full update in Stories &amp; Knowledge).
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit update" : "New update"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="clc-label" className={labelClass}>Label</label>
            <input id="clc-label" value={form.label} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label htmlFor="clc-date" className={labelClass}>Date shown</label>
            <input id="clc-date" type="date" value={form.displayDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, displayDate: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="clc-title" className={labelClass}>Title</label>
            <input id="clc-title" required maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="clc-summary" className={labelClass}>Short text</label>
            <textarea id="clc-summary" required maxLength={400} rows={2} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="clc-story" className={labelClass}>&ldquo;Read the update&rdquo; opens</label>
            <select id="clc-story" value={form.storyId ?? ""} onChange={(e) => setForm((f) => ({ ...f, storyId: e.target.value || null }))} className={inputClass}>
              <option value="">No button</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.status !== "PUBLISHED" ? " (draft)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <p className={labelClass}>Show to (none = draft, shown to nobody)</p>
            <div className="mt-1 flex flex-wrap gap-4">
              {TIERS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-1.5 text-sm text-cashmere-text">
                  <input type="checkbox" checked={form.tiers.includes(value)} onChange={() => toggleTier(value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-sm text-cashmere-text">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
            <div className="ml-auto flex gap-2">
              {editingId && (
                <button type="button" onClick={startCreate} className="rounded-full border border-cashmere-border px-5 py-2.5 text-sm font-medium text-cashmere-text hover:border-cashmere-accent">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-cashmere-accent-dark disabled:opacity-60">
                {!editingId && <Plus size={16} strokeWidth={2} />}
                {saving ? "Saving…" : editingId ? "Save changes" : "Add"}
              </button>
            </div>
          </div>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        {!editingId && <p className="mt-3 text-xs text-cashmere-text-muted">Add the update first, then upload its image below.</p>}
      </section>

      {loadError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load updates ({loadError}).</p>}
      {!rows && !loadError && <p className="text-cashmere-text-muted">Loading…</p>}

      {rows && (
        <section className="flex flex-col gap-3">
          {rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">No updates yet — add one above.</p>
          )}
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-4 rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="relative aspect-[3/1] w-full shrink-0 overflow-hidden rounded-lg bg-cashmere-sidebar/60 sm:w-56">
                {row.imageUrl ? (
                  <Image src={row.imageUrl} alt="" fill className="object-cover object-right" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-cashmere-text-muted">No image</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">{row.label}</p>
                <p className="font-medium text-cashmere-text">
                  {row.title} {!row.active && <span className="text-xs text-red-600">(inactive)</span>}
                </p>
                <p className="mt-1 text-sm text-cashmere-text-muted">{row.summary}</p>
                <p className="mt-1 text-xs text-cashmere-text-muted">
                  {row.displayDate ? new Date(row.displayDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "No date"}
                  {" · "}
                  {row.story ? `Opens: ${row.story.title}` : "No button"}
                  {" · "}
                  {row.tiers.length ? row.tiers.map((t) => TIERS.find((x) => x.value === t)?.label ?? t).join(", ") : "Draft"}
                </p>
                <div className="mt-3">
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
                    className="flex items-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text hover:border-cashmere-accent disabled:opacity-60"
                  >
                    <Upload size={12} strokeWidth={2} />
                    {imageBusyId === row.id ? "Uploading…" : row.imageUrl ? "Replace image" : "Upload image"}
                  </button>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(row)} aria-label={`Edit ${row.title}`} className="rounded-full border border-cashmere-border p-2 text-cashmere-text hover:border-cashmere-accent">
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
                <button onClick={() => handleDelete(row)} aria-label={`Delete ${row.title}`} className="rounded-full border border-cashmere-border p-2 text-cashmere-text hover:border-red-400 hover:text-red-600">
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
