"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload, X, ChevronUp, ChevronDown, Type, ImageIcon, Images, Quote, Eye } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchStoryCatalog,
  createStory,
  updateStory,
  deleteStory,
  uploadStoryImage,
  deleteStoryImage,
  uploadStorySectionImage,
  fetchStoryCategories,
  createStoryCategory,
  StaffStory,
  StoryInput,
  StoryCategory,
  StorySection,
  StorySectionType,
} from "@/lib/staff-api";

const TIERS: StoryInput["tiers"][number][] = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"];

const SECTION_TYPES: { type: StorySectionType; label: string; icon: typeof Type }[] = [
  { type: "TEXT", label: "Text", icon: Type },
  { type: "IMAGE", label: "Image", icon: ImageIcon },
  { type: "IMAGE_GALLERY", label: "Image Gallery", icon: Images },
  { type: "QUOTE", label: "Quote", icon: Quote },
];

const EMPTY_FORM: StoryInput = {
  title: "",
  categoryId: "",
  designerName: "",
  tiers: [],
  status: "DRAFT",
  featured: false,
  sortOrder: 0,
  sections: [],
};

// Content Manager per the seeded role description ("Editorial content:
// stories, news, videos, Care & Repair guides.") — server-side already
// enforces this on every /story-catalog endpoint, this is just the matching
// UI guard. Rebuilt 2026-09-25 (client email 2026-09-22/24) into one
// flexible, reusable article structure — every story is an ordered list of
// typed sections staff compose here, not a fixed body/quote form, so the
// same template covers a short Story and a longer Designer Spotlight
// without needing a separate layout for either.
export default function StoriesAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);
  const canManageCategories = staffHasAnyRole(staff, ["Super Administrator"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffStory[] }
  >({ status: "loading" });
  const [categories, setCategories] = useState<StoryCategory[]>([]);
  const [form, setForm] = useState<StoryInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const [sectionUploadBusy, setSectionUploadBusy] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const sectionImageInputRef = useRef<HTMLInputElement | null>(null);
  const sectionGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSectionIndex = useRef<number | null>(null);

  function load() {
    fetchStoryCatalog()
      .then((rows) => setState({ status: "loaded", rows }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  function loadCategories() {
    fetchStoryCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }

  useEffect(() => {
    if (!canManage) {
      router.replace("/staff");
      return;
    }
    load();
    loadCategories();
  }, [canManage, router]);

  if (!canManage) return null;

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setFormError(null);
  }

  function startEdit(row: StaffStory) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      categoryId: row.category.id,
      designerName: row.designerName ?? "",
      tiers: row.tiers,
      status: row.status,
      featured: row.featured,
      sortOrder: row.sortOrder,
      sections: [...row.sections].sort((a, b) => a.order - b.order),
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
        designerName: form.designerName || undefined,
        // Recompute order from display position — reordering just moves
        // array entries around, it doesn't keep `order` in sync itself.
        // Picked explicitly (not `{ ...s, order: i }`): editing an existing
        // story carries id/storyId/createdAt/updatedAt on each section from
        // the GET response into form state (see startEdit below), and the
        // backend's StorySectionDto whitelist rejects any of those coming
        // back on save ("property id should not exist", etc.) — a spread
        // forwards them, an explicit pick doesn't.
        sections: form.sections.map((s, i) => ({
          order: i,
          type: s.type,
          text: s.text,
          imageUrl: s.imageUrl,
          galleryImageUrls: s.galleryImageUrls,
          quoteText: s.quoteText,
          quoteAttribution: s.quoteAttribution,
        })),
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

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const created = await createStoryCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, categoryId: created.id }));
      setNewCategoryName("");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setAddingCategory(false);
    }
  }

  function addSection(type: StorySectionType) {
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { order: f.sections.length, type, galleryImageUrls: [] }],
    }));
  }

  function removeSection(index: number) {
    setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== index) }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setForm((f) => {
      const target = index + direction;
      if (target < 0 || target >= f.sections.length) return f;
      const next = [...f.sections];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...f, sections: next };
    });
  }

  function updateSection(index: number, patch: Partial<StorySection>) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  async function handleSectionImageFile(index: number, file: File) {
    setSectionUploadBusy(index);
    try {
      const { url } = await uploadStorySectionImage(file);
      updateSection(index, { imageUrl: url });
    } finally {
      setSectionUploadBusy(null);
    }
  }

  async function handleSectionGalleryFile(index: number, file: File) {
    setSectionUploadBusy(index);
    try {
      const { url } = await uploadStorySectionImage(file);
      const current = form.sections[index]?.galleryImageUrls ?? [];
      updateSection(index, { galleryImageUrls: [...current, url] });
    } finally {
      setSectionUploadBusy(null);
    }
  }

  function removeGalleryImage(index: number, url: string) {
    const current = form.sections[index]?.galleryImageUrls ?? [];
    updateSection(index, { galleryImageUrls: current.filter((u) => u !== url) });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Stories &amp; Knowledge</h1>
        <p className="mt-1 text-cashmere-text-muted">
          One flexible article structure for every story, Designer Spotlight included — mix text, images and quotes
          in whatever order and combination each article needs.
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit article" : "New article"}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Category</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a category…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {canManageCategories && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Add a new category…"
                    className="w-full rounded-lg border border-cashmere-border px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={addingCategory || !newCategoryName.trim()}
                    onClick={handleAddCategory}
                    className="shrink-0 rounded-lg border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text hover:border-cashmere-accent disabled:opacity-60"
                  >
                    {addingCategory ? "Adding…" : "Add"}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Designer name</label>
              <input
                value={form.designerName}
                onChange={(e) => setForm((f) => ({ ...f, designerName: e.target.value }))}
                placeholder="For Designer Spotlight — matches the designer's Design Lab concepts"
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">
              Visible to tiers (none selected = not targeted yet)
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

          {/* Section builder */}
          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Sections</label>
            <div className="mt-2 flex flex-col gap-3">
              {form.sections.map((section, index) => (
                <div key={index} className="rounded-xl border border-cashmere-border bg-cashmere-bg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">
                      {SECTION_TYPES.find((t) => t.type === section.type)?.label ?? section.type}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveSection(index, -1)}
                        aria-label="Move up"
                        className="rounded p-1 text-cashmere-text-muted hover:text-cashmere-text disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === form.sections.length - 1}
                        onClick={() => moveSection(index, 1)}
                        aria-label="Move down"
                        className="rounded p-1 text-cashmere-text-muted hover:text-cashmere-text disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        aria-label="Remove section"
                        className="rounded p-1 text-cashmere-text-muted hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    {section.type === "TEXT" && (
                      <textarea
                        value={section.text ?? ""}
                        onChange={(e) => updateSection(index, { text: e.target.value })}
                        rows={4}
                        placeholder="Text for this section…"
                        className="w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                      />
                    )}

                    {section.type === "QUOTE" && (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={section.quoteText ?? ""}
                          onChange={(e) => updateSection(index, { quoteText: e.target.value })}
                          rows={2}
                          placeholder="Quote text…"
                          className="w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                        />
                        <input
                          value={section.quoteAttribution ?? ""}
                          onChange={(e) => updateSection(index, { quoteAttribution: e.target.value })}
                          placeholder="Attribution (optional) — e.g. Morten"
                          className="w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    {section.type === "IMAGE" && (
                      <div>
                        {section.imageUrl && (
                          <div className="relative mb-2 h-32 w-full overflow-hidden rounded-lg">
                            <Image src={section.imageUrl} alt="" fill className="object-cover" />
                          </div>
                        )}
                        <input
                          ref={sectionImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            const i = pendingSectionIndex.current;
                            if (file && i !== null) void handleSectionImageFile(i, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          disabled={sectionUploadBusy === index}
                          onClick={() => {
                            pendingSectionIndex.current = index;
                            sectionImageInputRef.current?.click();
                          }}
                          className="flex items-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text hover:border-cashmere-accent disabled:opacity-60"
                        >
                          <Upload size={12} strokeWidth={2} />
                          {sectionUploadBusy === index ? "Uploading…" : section.imageUrl ? "Replace image" : "Upload image"}
                        </button>
                      </div>
                    )}

                    {section.type === "IMAGE_GALLERY" && (
                      <div>
                        {section.galleryImageUrls && section.galleryImageUrls.length > 0 && (
                          <div className="mb-2 grid grid-cols-4 gap-2">
                            {section.galleryImageUrls.map((url) => (
                              <div key={url} className="group relative aspect-square overflow-hidden rounded-lg">
                                <Image src={url} alt="" fill className="object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeGalleryImage(index, url)}
                                  aria-label="Remove from gallery"
                                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          ref={sectionGalleryInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            const i = pendingSectionIndex.current;
                            if (file && i !== null) void handleSectionGalleryFile(i, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          disabled={sectionUploadBusy === index}
                          onClick={() => {
                            pendingSectionIndex.current = index;
                            sectionGalleryInputRef.current?.click();
                          }}
                          className="flex items-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text hover:border-cashmere-accent disabled:opacity-60"
                        >
                          <Upload size={12} strokeWidth={2} />
                          {sectionUploadBusy === index ? "Uploading…" : "Add image to gallery"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {form.sections.length === 0 && (
                <p className="rounded-lg border border-dashed border-cashmere-border p-4 text-center text-xs text-cashmere-text-muted">
                  No sections yet — add one below.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {SECTION_TYPES.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addSection(type)}
                    className="flex items-center gap-1.5 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
                  >
                    <Icon size={13} strokeWidth={1.75} />
                    Add {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as StoryInput["status"] }))
                }
                className="mt-1 rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
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
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
              />
              Featured on homepage
            </label>

            <div className="ml-auto flex gap-2">
              {editingId && (
                <a
                  href={`/preview/stories/${editingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-cashmere-border px-5 py-2.5 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
                >
                  <Eye size={16} strokeWidth={2} />
                  Preview
                </a>
              )}
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
                disabled={saving || !form.categoryId}
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-cashmere-text">{row.title}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      row.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-cashmere-sidebar text-cashmere-text-muted"
                    }`}
                  >
                    {row.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                  {row.featured && (
                    <span className="rounded-full bg-cashmere-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                      Featured
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-cashmere-text-muted">
                  {row.category.name}
                  {row.designerName && ` — ${row.designerName}`}
                  {` · ${row.sections.length} section${row.sections.length === 1 ? "" : "s"}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.tiers.length === 0 && <span className="text-xs text-cashmere-text-muted">No tiers</span>}
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
                    {imageBusyId === row.id ? "Working…" : row.heroImageUrl ? "Replace hero photo" : "Upload hero photo"}
                  </button>
                  {row.heroImageUrl && (
                    <button
                      type="button"
                      disabled={imageBusyId === row.id}
                      onClick={() => handleImageRemove(row.id)}
                      className="text-xs font-medium text-cashmere-text-muted hover:text-red-600 disabled:opacity-60"
                    >
                      Remove hero photo
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
