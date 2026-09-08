"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trash2, Upload } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchSiteImages,
  uploadSiteImage,
  deleteSiteImage,
  StaffSiteImage,
  SiteImageSlot,
  MembershipTierValue,
} from "@/lib/staff-api";

const SLOTS: { key: SiteImageSlot; label: string }[] = [
  { key: "DASHBOARD_HERO", label: "Dashboard hero" },
  { key: "CARE_REPAIR_HERO", label: "Care & Repair hero" },
];
const TIERS: MembershipTierValue[] = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"];

// Club Manager or Content Manager per benefits.controller.ts's same reasoning
// — server-side already enforces this on every /site-image-catalog endpoint,
// this is just the matching UI guard.
export default function SiteImagesAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Club Manager", "Content Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffSiteImage[] }
  >({ status: "loading" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchSiteImages()
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

  function rowFor(slot: SiteImageSlot, tier: MembershipTierValue): StaffSiteImage | undefined {
    return state.status === "loaded" ? state.rows.find((r) => r.slot === slot && r.tier === tier) : undefined;
  }

  async function handleUpload(slot: SiteImageSlot, tier: MembershipTierValue, file: File) {
    const key = `${slot}:${tier}`;
    setBusyKey(key);
    setError(null);
    try {
      await uploadSiteImage(slot, tier, file);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemove(slot: SiteImageSlot, tier: MembershipTierValue) {
    const key = `${slot}:${tier}`;
    setBusyKey(key);
    setError(null);
    try {
      await deleteSiteImage(slot, tier);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Site Images</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Upload a different photo per membership tier for each hero spot below. A tier with no photo uploaded
          keeps using the site&apos;s default image.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load images ({state.message}).</p>
      )}

      {state.status === "loaded" &&
        SLOTS.map(({ key: slot, label }) => (
          <section key={slot} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">{label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TIERS.map((tier) => (
                <TierImageCard
                  key={tier}
                  tier={tier}
                  row={rowFor(slot, tier)}
                  busy={busyKey === `${slot}:${tier}`}
                  onUpload={(file) => handleUpload(slot, tier, file)}
                  onRemove={() => handleRemove(slot, tier)}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function TierImageCard({
  tier,
  row,
  busy,
  onUpload,
  onRemove,
}: {
  tier: MembershipTierValue;
  row: StaffSiteImage | undefined;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-cashmere-border bg-white">
      <div className="relative h-32 bg-cashmere-sidebar/60">
        {row ? (
          <Image src={row.url} alt="" fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-cashmere-text-muted">
            Using default
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text">{tier}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1 rounded-full border border-cashmere-border px-3 py-1.5 text-xs font-medium text-cashmere-text transition-colors hover:border-cashmere-accent disabled:opacity-60"
          >
            <Upload size={12} strokeWidth={2} />
            {busy ? "Uploading…" : row ? "Replace" : "Upload"}
          </button>
          {row && (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              aria-label={`Remove ${tier} image`}
              className="rounded-full border border-cashmere-border p-1.5 text-cashmere-text transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-60"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
