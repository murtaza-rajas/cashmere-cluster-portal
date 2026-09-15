"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchMembershipLevelCatalog,
  updateMembershipLevel,
  StaffMembershipLevel,
  MembershipLevelInput,
  MembershipTierValue,
} from "@/lib/staff-api";
import { getAccessLevel, AccessLevel, PortalArea } from "@/lib/access";

const TIER_ORDER: MembershipTierValue[] = ["FOUNDING", "ANNUAL", "NEWSLETTER", "MONGOLIA"];

const AREAS: { key: PortalArea; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "memberOffers", label: "Member Offers" },
  { key: "exclusiveCollections", label: "Exclusive Collections" },
  { key: "myOrders", label: "My Orders" },
  { key: "myCollection", label: "My Collection" },
  { key: "wishlist", label: "Wishlist" },
  { key: "invitationsEvents", label: "Invitations & Events" },
  { key: "storiesKnowledge", label: "Stories & Knowledge" },
  { key: "careRepair", label: "Care & Repair" },
  { key: "myBenefits", label: "My Benefits" },
  { key: "profile", label: "Profile" },
  { key: "settings", label: "Settings" },
  { key: "helpSupport", label: "Help & Support" },
  { key: "designLab", label: "Design Lab" },
];

const ACCESS_BADGE: Record<AccessLevel, string> = {
  full: "bg-green-100 text-green-700",
  preview: "bg-amber-100 text-amber-700",
  none: "bg-cashmere-sidebar text-cashmere-text-muted",
};

type FormState = {
  displayName: string;
  priceEur: string;
  priceUsd: string;
  periodLabel: string;
  benefits: string;
};

function toForm(row: StaffMembershipLevel): FormState {
  return {
    displayName: row.displayName,
    priceEur: row.priceEur ?? "",
    priceUsd: row.priceUsd ?? "",
    periodLabel: row.periodLabel ?? "",
    benefits: row.benefits ?? "",
  };
}

// Club Manager per the seeded role description ("Membership operation and
// overall club activity: members, status, benefits, offers, reporting.") —
// an exact match. One fixed card per existing tier (Founding/Annual/
// Newsletter/Mongolia) — staff edit name/price/period/benefits per level;
// "access" (which portal areas a tier reaches) is shown read-only below each
// card, computed from the same web/lib/access.ts matrix every member page
// already enforces server-independent-of-this-admin — not editable here on
// purpose, see MembershipLevel's schema comment.
export default function MembershipLevelsAdminPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Club Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffMembershipLevel[] }
  >({ status: "loading" });
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  function load() {
    fetchMembershipLevelCatalog()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
        setState({ status: "loaded", rows: sorted });
        setForms(Object.fromEntries(sorted.map((r) => [r.tier, toForm(r)])));
      })
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

  async function handleSave(tier: MembershipTierValue) {
    const form = forms[tier];
    setSavingTier(tier);
    setFormError(null);
    try {
      const payload: MembershipLevelInput = {
        displayName: form.displayName || undefined,
        priceEur: form.priceEur === "" ? undefined : Number(form.priceEur),
        priceUsd: form.priceUsd === "" ? undefined : Number(form.priceUsd),
        periodLabel: form.periodLabel || undefined,
        benefits: form.benefits || undefined,
      };
      await updateMembershipLevel(tier, payload);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSavingTier(null);
    }
  }

  function setField(tier: string, field: keyof FormState, value: string) {
    setForms((prev) => ({ ...prev, [tier]: { ...prev[tier], [field]: value } }));
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Membership Levels</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Name, price (EUR and USD), membership period and benefits for each level. Which portal areas a level can
          reach is fixed by the platform&apos;s access rules, not editable here — see &quot;Access (read-only)&quot;
          on each card.
        </p>
      </div>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load membership levels ({state.message}).
        </p>
      )}
      {formError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}

      {state.status === "loaded" && (
        <div className="flex flex-col gap-4">
          {state.rows.map((row) => {
            const form = forms[row.tier] ?? toForm(row);
            const isExpanded = expandedTier === row.tier;
            return (
              <section key={row.tier} className="rounded-2xl border border-cashmere-border bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">{row.tier}</p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Display name</label>
                    <input
                      value={form.displayName}
                      onChange={(e) => setField(row.tier, "displayName", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Membership period</label>
                    <input
                      value={form.periodLabel}
                      onChange={(e) => setField(row.tier, "periodLabel", e.target.value)}
                      placeholder="e.g. 5 years, 1 year, Free"
                      className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Price (EUR)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceEur}
                      onChange={(e) => setField(row.tier, "priceEur", e.target.value)}
                      placeholder="Not yet confirmed"
                      className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Price (USD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceUsd}
                      onChange={(e) => setField(row.tier, "priceUsd", e.target.value)}
                      placeholder="Not yet confirmed"
                      className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Benefits</label>
                  <textarea
                    value={form.benefits}
                    onChange={(e) => setField(row.tier, "benefits", e.target.value)}
                    rows={3}
                    placeholder="Summary of what this level includes…"
                    className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedTier(isExpanded ? null : row.tier)}
                    className="flex items-center gap-1 text-xs font-medium text-cashmere-text-muted hover:text-cashmere-text"
                  >
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    Access (read-only)
                  </button>
                  <button
                    type="button"
                    disabled={savingTier === row.tier}
                    onClick={() => handleSave(row.tier)}
                    className="rounded-full bg-cashmere-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
                  >
                    {savingTier === row.tier ? "Saving…" : "Save"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-cashmere-sidebar/40 p-4 sm:grid-cols-3">
                    {AREAS.map((area) => {
                      const level = getAccessLevel(row.tier, area.key);
                      return (
                        <div key={area.key} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-cashmere-text-muted">{area.label}</span>
                          <span className={`rounded-full px-2 py-0.5 font-medium ${ACCESS_BADGE[level]}`}>{level}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
