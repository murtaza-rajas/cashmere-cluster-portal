"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Globe2, Plus } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMongoliaStoryCatalog, createMongoliaStory, StaffMongoliaStory, MongoliaStoryInput } from "@/lib/staff-api";

const CATEGORY = "Mongolia and the World";

const EMPTY_FORM: MongoliaStoryInput = {
  title: "",
  excerpt: "",
  body: "",
  category: CATEGORY,
  foundingOnly: false,
  sortOrder: 0,
  active: true,
};

// "Mongolia and the World" (client's mockup, 2026-09-11) is the diaspora/
// global-community content named in the 2026-09-09 email ("full stories...
// content" for Founding). Not a separate content model — Stories already
// has a freeform `category` field (see mongolia.service.ts), so this is a
// filtered view of the same Stories & News data, same reuse principle the
// client asked for. Full editing (image upload, delete) stays on the
// Stories & News page — this is a quick filtered view + fast-add shortcut.
export default function MongoliaWorldPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager", "Mongolia Editor"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffMongoliaStory[] }
  >({ status: "loading" });
  const [form, setForm] = useState<MongoliaStoryInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    fetchMongoliaStoryCatalog()
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

  const rows = state.status === "loaded" ? state.rows.filter((r) => r.category === CATEGORY) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await createMongoliaStory({ ...form, excerpt: form.excerpt || undefined, body: form.body || undefined });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Mongolia and the World</h1>
          <p className="mt-1 text-cashmere-text-muted">
            Stories about the Mongolian diaspora and Mongolia&apos;s place in the global cashmere community — a category
            within Stories &amp; News, not a separate feature.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-cashmere-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
        >
          <Plus size={16} strokeWidth={2} />
          Add story
        </button>
      </div>

      {showForm && (
        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Excerpt</label>
              <input
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-cashmere-text">
              <input
                type="checkbox"
                checked={form.foundingOnly}
                onChange={(e) => setForm((f) => ({ ...f, foundingOnly: e.target.checked }))}
              />
              Founding Member only
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full border border-cashmere-border px-5 py-2.5 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </form>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        </section>
      )}

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load stories ({state.message}).</p>
      )}

      {state.status === "loaded" && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <Globe2 size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <p className="font-medium text-cashmere-text">No stories in this category yet</p>
          <p className="max-w-sm text-sm text-cashmere-text-muted">Add one above, or tag an existing story from Stories &amp; News.</p>
        </div>
      )}

      {rows.length > 0 && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Link
              key={row.id}
              href="/staff/mongolia/stories"
              className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent"
            >
              <div className="relative h-32 overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                {row.heroImageUrl ? (
                  <Image src={row.heroImageUrl} alt="" fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Globe2 size={24} strokeWidth={1.5} className="text-cashmere-text-muted" />
                  </div>
                )}
              </div>
              <p className="font-medium text-cashmere-text">{row.title}</p>
              {row.excerpt && <p className="text-sm text-cashmere-text-muted">{row.excerpt}</p>}
              {!row.active && <span className="text-xs text-red-600">(inactive)</span>}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
