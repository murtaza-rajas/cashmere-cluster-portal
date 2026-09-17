"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Heart, BarChart3, Palette, Sparkles } from "lucide-react";
import { RequireAccess } from "@/components/require-access";
import {
  fetchMyDesigns,
  favoriteDesign,
  unfavoriteDesign,
  voteDesign,
  unvoteDesign,
  MemberDesign,
} from "@/lib/api";

type Tab = "CURRENT" | "SELECTED_FOR_DEVELOPMENT" | "SELECTED_FOR_PRODUCTION" | "PAST_ROUND" | "FAVOURITES";

// "Coming to Production" — client's own wording (2026-09-15), used here
// instead of "Selected for Production" even though the underlying
// DesignStatus enum value is unchanged (SELECTED_FOR_PRODUCTION). Staff's
// own admin dropdown still shows the technical status name; this is purely
// the member-facing label. SELECTED_FOR_DEVELOPMENT added 2026-09-17, per
// the client's own flow: "Member Favourite -> Selected for Development ->
// Coming to Production."
const TAB_LABELS: Record<Tab, string> = {
  CURRENT: "Current Designs",
  SELECTED_FOR_DEVELOPMENT: "Selected for Development",
  SELECTED_FOR_PRODUCTION: "Coming to Production",
  FAVOURITES: "Your Favourites",
  PAST_ROUND: "Past Rounds",
};

// Founders' Design Lab — international-only, tier-gated to Founding (view +
// save + vote) and Annual (view + save, no vote — see access.ts). Newsletter
// and Mongolia never reach this page at all (RequireAccess redirects them
// away). Whether the Vote button/count renders is driven entirely by each
// design's own `canVote` from the API, not re-derived here, so there's one
// source of truth for the tier rule (already enforced server-side too).
export default function DesignLabPage() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; designs: MemberDesign[] }
  >({ status: "loading" });
  const [tab, setTab] = useState<Tab>("CURRENT");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetchMyDesigns()
      .then((designs) => setState({ status: "loaded", designs }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(load, []);

  async function toggleFavorite(design: MemberDesign) {
    setBusyId(design.id);
    try {
      if (design.isFavorited) {
        await unfavoriteDesign(design.id);
      } else {
        await favoriteDesign(design.id);
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleVote(design: MemberDesign) {
    setBusyId(design.id);
    try {
      if (design.isVoted) {
        await unvoteDesign(design.id);
      } else {
        await voteDesign(design.id);
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  const designs = state.status === "loaded" ? state.designs : [];
  const counts: Record<Tab, number> = {
    CURRENT: designs.filter((d) => d.status === "CURRENT").length,
    SELECTED_FOR_DEVELOPMENT: designs.filter((d) => d.status === "SELECTED_FOR_DEVELOPMENT").length,
    SELECTED_FOR_PRODUCTION: designs.filter((d) => d.status === "SELECTED_FOR_PRODUCTION").length,
    PAST_ROUND: designs.filter((d) => d.status === "PAST_ROUND").length,
    FAVOURITES: designs.filter((d) => d.isFavorited).length,
  };
  const visible =
    tab === "FAVOURITES" ? designs.filter((d) => d.isFavorited) : designs.filter((d) => d.status === tab);

  // "Member Favourite" — client instruction (2026-09-15): "we should not
  // display public vote counts, rankings or other competitive metrics.
  // Instead, we should use positive development indicators such as...
  // 'Member Favourite'." Converts the real favoriteCount data into a single
  // qualitative badge instead of a number: the one CURRENT design with the
  // most saves (ties broken by list order), only once at least one member
  // has actually favorited something — never awarded to an all-zero round.
  const memberFavouriteId = designs
    .filter((d) => d.status === "CURRENT" && d.favoriteCount > 0)
    .reduce<MemberDesign | null>(
      (best, d) => (!best || d.favoriteCount > best.favoriteCount ? d : best),
      null,
    )?.id;

  return (
    <RequireAccess area="designLab">
      <div className="flex w-full flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent">Founders&apos; Design Lab</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight text-cashmere-text">Help shape what we make next</h1>
          <p className="mt-1 text-cashmere-text-muted">
            Explore designs currently in development. Save your favourites, and if you&apos;re a Founding Member,
            vote for what you&apos;d like to see go into production.
          </p>
        </div>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading designs…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load designs ({state.message}).
          </p>
        )}

        {state.status === "loaded" && (
          <>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? "bg-cashmere-navy text-white"
                      : "border border-cashmere-border text-cashmere-text hover:border-cashmere-accent"
                  }`}
                >
                  {TAB_LABELS[t]} ({counts[t]})
                </button>
              ))}
            </div>

            {visible.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
                <Palette size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
                <p className="font-medium text-cashmere-text">
                  {tab === "FAVOURITES" ? "No favourites saved yet" : "Nothing here yet"}
                </p>
                <p className="max-w-sm text-sm text-cashmere-text-muted">
                  {tab === "FAVOURITES"
                    ? "Save a design you love and it'll show up here."
                    : "Check back soon for new designs."}
                </p>
              </div>
            )}

            {visible.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((design) => (
                  <div key={design.id} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5">
                    {design.id === memberFavouriteId && (
                      <span className="flex w-fit items-center gap-1 rounded-full bg-cashmere-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                        <Sparkles size={11} strokeWidth={2} />
                        Member Favourite
                      </span>
                    )}
                    <div className="flex gap-2">
                      <div className="relative h-40 flex-1 overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                        {design.heroImageUrl ? (
                          <Image src={design.heroImageUrl} alt="" fill className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Palette size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
                          </div>
                        )}
                      </div>
                      <div className="flex w-16 flex-col gap-2">
                        <div className="relative h-[76px] overflow-hidden rounded-lg bg-cashmere-sidebar/60">
                          {design.swatchImageUrl && <Image src={design.swatchImageUrl} alt="" fill className="object-cover" />}
                        </div>
                        <div className="relative h-[76px] overflow-hidden rounded-lg bg-cashmere-sidebar/60">
                          {design.sketchImageUrl && <Image src={design.sketchImageUrl} alt="" fill className="object-cover" />}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-medium text-cashmere-text">{design.title}</p>
                      {design.description && <p className="mt-0.5 text-sm text-cashmere-text-muted">{design.description}</p>}
                    </div>

                    {design.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {design.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-cashmere-sidebar px-2 py-0.5 text-[10px] font-medium text-cashmere-text-muted"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center gap-2 border-t border-cashmere-border pt-3">
                      <button
                        type="button"
                        disabled={busyId === design.id}
                        onClick={() => toggleFavorite(design)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                          design.isFavorited
                            ? "border-cashmere-accent bg-cashmere-accent/10 text-cashmere-accent-dark"
                            : "border-cashmere-border text-cashmere-text hover:border-cashmere-accent"
                        }`}
                      >
                        <Heart size={14} strokeWidth={2} fill={design.isFavorited ? "currentColor" : "none"} />
                        {design.isFavorited ? "Saved" : "Save"}
                      </button>
                      {design.canVote ? (
                        <button
                          type="button"
                          disabled={busyId === design.id}
                          onClick={() => toggleVote(design)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60 ${
                            design.isVoted ? "bg-cashmere-accent-dark" : "bg-cashmere-accent hover:bg-cashmere-accent-dark"
                          }`}
                        >
                          <BarChart3 size={14} strokeWidth={2} />
                          {design.isVoted ? "Voted" : "Vote"}
                        </button>
                      ) : design.isVoted ? (
                        // Voting closed (client email 2026-09-17: it closes
                        // for everyone once a design reaches "Coming to
                        // Production") after this member already voted —
                        // the vote itself isn't erased, so say so rather
                        // than silently dropping the indicator.
                        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-cashmere-accent bg-cashmere-accent/10 px-3 py-1.5 text-xs font-medium text-cashmere-accent-dark">
                          <BarChart3 size={14} strokeWidth={2} />
                          Voted
                        </span>
                      ) : (
                        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-dashed border-cashmere-border px-3 py-1.5 text-[11px] text-cashmere-text-muted">
                          {design.status === "SELECTED_FOR_PRODUCTION" || design.status === "PAST_ROUND"
                            ? "Voting closed"
                            : "Founding Members vote"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </RequireAccess>
  );
}
