"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, Factory, Images, Vote } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { fetchMyMongoliaStories, fetchMyMongoliaProducers, type MongoliaStory, type MongoliaProducer } from "@/lib/api";

// Content types built so far: Stories & News, then Producer profiles — both
// named in the client's confirmed content list for both Mongolia levels
// (2026-09-09 email). The photo archive, voting, and Mongolia offers are
// real, later pieces of this same section — not built yet.
//
// 2026-09-10 — hero banner + quick-link row added after cross-checking this
// page against the client's own mockup (`2.5 CLC MN Founder Mobil.png`),
// which showed a materially richer "basic page structure" than the first
// pass here: a branded hero (headline/tagline/CTA) and a 4-tile quick-link
// row (Stories/Producers/Photo archive/Your voice), not just a bare list.
// Stories/Producers are real — the tiles scroll to the sections already
// below. Photo archive/Your voice stay honest disabled tiles, same
// "Coming soon" discipline used elsewhere in this app (e.g. the staff
// Dashboard's Design Lab/Stories cards before those existed) — inventing a
// live-looking link to a page/feature that doesn't exist yet would be
// worse than admitting it's not built. The bottom tab bar shown in the same
// mockup (Home/Explore/Vote/Offers/Profile) is a bigger, separate piece —
// still deferred, tracked in PROJECT_TRACKER.md, not attempted here.
export default function MongoliaHomePage() {
  const member = useMember();
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; stories: MongoliaStory[] }
  >({ status: "loading" });
  const [producerState, setProducerState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; producers: MongoliaProducer[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchMyMongoliaStories()
      .then((stories) => setState({ status: "loaded", stories }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
    fetchMyMongoliaProducers()
      .then((producers) => setProducerState({ status: "loaded", producers }))
      .catch((err: Error) => setProducerState({ status: "error", message: err.message }));
  }, []);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {/* No approved Mongolia photography exists yet (same gap noted on the
          pre-login landing page and Dashboard hero) — a navy gradient
          stands in for the mockup's steppe/herder photography rather than
          using an unapproved stock image. */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-cashmere-navy to-cashmere-navy-dark px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Cashmere Lovers Club Mongolia
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">People. Mongolia. Opportunities.</h1>
        <p className="mt-3 max-w-md text-white/80">
          A global community for everyone who loves Mongolian cashmere. Welcome back, {member.firstName ?? member.email}.
        </p>
        <a
          href="#stories"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-cashmere-navy transition-colors hover:bg-white/90"
        >
          Explore our stories →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <a
          href="#stories"
          className="flex flex-col items-center gap-2 rounded-2xl border border-cashmere-border bg-white px-3 py-5 text-center transition-colors hover:border-cashmere-accent"
        >
          <BookOpen size={22} strokeWidth={1.5} className="text-cashmere-accent-dark" />
          <span className="text-sm font-medium text-cashmere-text">Stories</span>
        </a>
        <a
          href="#producers"
          className="flex flex-col items-center gap-2 rounded-2xl border border-cashmere-border bg-white px-3 py-5 text-center transition-colors hover:border-cashmere-accent"
        >
          <Factory size={22} strokeWidth={1.5} className="text-cashmere-accent-dark" />
          <span className="text-sm font-medium text-cashmere-text">Our producers</span>
        </a>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-cashmere-border px-3 py-5 text-center opacity-60">
          <Images size={22} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <span className="text-sm font-medium text-cashmere-text-muted">Photo archive</span>
          <span className="text-[10px] uppercase tracking-wide text-cashmere-text-muted">Coming soon</span>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-cashmere-border px-3 py-5 text-center opacity-60">
          <Vote size={22} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <span className="text-sm font-medium text-cashmere-text-muted">Your voice</span>
          <span className="text-[10px] uppercase tracking-wide text-cashmere-text-muted">Coming soon</span>
        </div>
      </div>

      <div id="stories">
        <h2 className="font-serif text-xl tracking-tight text-cashmere-text">Stories &amp; News</h2>

        {state.status === "loading" && <p className="mt-3 text-cashmere-text-muted">Loading…</p>}
        {state.status === "error" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load stories ({state.message}).
          </p>
        )}

        {state.status === "loaded" && state.stories.length === 0 && (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <BookOpen size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">No stories yet</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">Check back soon for news and community stories.</p>
          </div>
        )}

        {state.status === "loaded" && state.stories.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {state.stories.map((story) => (
              <div key={story.id} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5">
                <div className="relative h-40 overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                  {story.heroImageUrl ? (
                    <Image src={story.heroImageUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {story.category && (
                    <span className="rounded-full bg-cashmere-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                      {story.category}
                    </span>
                  )}
                  {story.foundingOnly && (
                    <span className="rounded-full bg-cashmere-navy/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-navy">
                      Founding Member
                    </span>
                  )}
                </div>
                <p className="font-medium text-cashmere-text">{story.title}</p>
                {story.excerpt && <p className="text-sm text-cashmere-text-muted">{story.excerpt}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="producers">
        <h2 className="font-serif text-xl tracking-tight text-cashmere-text">Producers</h2>

        {producerState.status === "loading" && <p className="mt-3 text-cashmere-text-muted">Loading…</p>}
        {producerState.status === "error" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load producers ({producerState.message}).
          </p>
        )}

        {producerState.status === "loaded" && producerState.producers.length === 0 && (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <Factory size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">No producers yet</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">Check back soon to meet the people behind the cashmere.</p>
          </div>
        )}

        {producerState.status === "loaded" && producerState.producers.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {producerState.producers.map((producer) => (
              <div key={producer.id} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5">
                <div className="relative h-40 overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                  {producer.heroImageUrl ? (
                    <Image src={producer.heroImageUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Factory size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {producer.craft && (
                    <span className="rounded-full bg-cashmere-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                      {producer.craft}
                    </span>
                  )}
                  {producer.foundingOnly && (
                    <span className="rounded-full bg-cashmere-navy/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-navy">
                      Founding Member
                    </span>
                  )}
                </div>
                <p className="font-medium text-cashmere-text">{producer.name}</p>
                {producer.location && <p className="text-xs text-cashmere-text-muted">{producer.location}</p>}
                {producer.story && <p className="text-sm text-cashmere-text-muted">{producer.story}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
