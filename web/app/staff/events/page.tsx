"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchEventCatalog,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadEventImage,
  deleteEventImage,
  StaffEvent,
  EventInput,
} from "@/lib/staff-api";

const TIERS: EventInput["tiers"][number][] = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"];

const EMPTY_FORM: EventInput = {
  title: "",
  description: "",
  locationType: "IN_PERSON",
  location: "",
  startsAt: "",
  registrationUrl: "",
  tiers: [],
  sortOrder: 0,
  active: true,
};

// Event Manager per the seeded role description ("Events and invitations:
// creation, audience, registration and attendance") — server-side already
// enforces this on every /event-catalog endpoint, this is just the matching
// UI guard.
export default function EventsAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Event Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffEvent[] }
  >({ status: "loading" });
  const [form, setForm] = useState<EventInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function load() {
    fetchEventCatalog()
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

  function startEdit(row: StaffEvent) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description ?? "",
      locationType: row.locationType,
      location: row.location ?? "",
      startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
      registrationUrl: row.registrationUrl ?? "",
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
      // Empty strings, not just omitted fields, need to become undefined here —
      // @IsOptional() on the backend DTO only skips validation for undefined/
      // null, not "". An untouched registrationUrl field left as "" would
      // otherwise still hit @IsUrl() and fail with "must be a URL address"
      // even though the field was never meant to be validated at all.
      const payload: EventInput = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        registrationUrl: form.registrationUrl || undefined,
        description: form.description || undefined,
        location: form.location || undefined,
      };
      if (editingId) {
        await updateEvent(editingId, payload);
      } else {
        await createEvent(payload);
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
    await deleteEvent(id);
    if (editingId === id) startCreate();
    load();
  }

  async function handleImageUpload(id: string, file: File) {
    setImageBusyId(id);
    try {
      await uploadEventImage(id, file);
      load();
    } finally {
      setImageBusyId(null);
    }
  }

  async function handleImageRemove(id: string) {
    setImageBusyId(id);
    try {
      await deleteEventImage(id);
      load();
    } finally {
      setImageBusyId(null);
    }
  }

  function toggleTier(tier: EventInput["tiers"][number]) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.includes(tier) ? prev.tiers.filter((t) => t !== tier) : [...prev.tiers, tier],
    }));
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Events &amp; Invitations</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Events shown on members&apos; Invitations &amp; Events page, scoped per tier.
        </p>
      </div>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">
          {editingId ? "Edit event" : "Add event"}
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
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Location type</label>
              <select
                value={form.locationType}
                onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value as EventInput["locationType"] }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              >
                <option value="IN_PERSON">In person</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Location detail</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Venue, or platform name"
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Date &amp; time</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[10px] text-cashmere-text-muted">Blank shows &quot;Date to be announced&quot;</p>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Registration URL</label>
            <input
              type="url"
              value={form.registrationUrl}
              onChange={(e) => setForm((f) => ({ ...f, registrationUrl: e.target.value }))}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-cashmere-text-muted">Blank shows &quot;Registration opening soon&quot;</p>
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
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load events ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-3">
          {state.rows.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No events yet — add one above.
            </p>
          )}
          {state.rows.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-4 rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-cashmere-sidebar/60">
                {row.imageUrl ? (
                  <Image src={row.imageUrl} alt="" fill className="object-cover" />
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
                {row.description && <p className="mt-1 text-sm text-cashmere-text-muted">{row.description}</p>}
                <p className="mt-1 text-xs text-cashmere-text-muted">
                  {row.locationType === "IN_PERSON" ? "In person" : "Online"}
                  {row.location ? ` — ${row.location}` : ""} ·{" "}
                  {row.startsAt ? new Date(row.startsAt).toLocaleString() : "Date to be announced"}
                </p>
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
                    {imageBusyId === row.id ? "Working…" : row.imageUrl ? "Replace photo" : "Upload photo"}
                  </button>
                  {row.imageUrl && (
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
