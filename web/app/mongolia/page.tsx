"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, Factory } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { fetchMyMongoliaStories, fetchMyMongoliaProducers, type MongoliaStory, type MongoliaProducer } from "@/lib/api";

// Content types built so far: Stories & News, then Producer profiles — both
// named in the client's confirmed content list for both Mongolia levels
// (2026-09-09 email). The photo archive, voting, and Mongolia offers are
// real, later pieces of this same section — not built yet.
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
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">
          Welcome, {member.firstName ?? member.email}
        </h1>
        <p className="mt-1 text-cashmere-text-muted">
          {member.membershipTier === "MONGOLIA"
            ? "Full access to Mongolia stories, community and updates."
            : "Selected Mongolia stories and community updates."}
        </p>
      </div>

      <div>
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

      <div>
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
