"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Newspaper, Sparkles } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";
import { fetchMyStories, MemberStory } from "@/lib/api";

// Real Stories & Knowledge content, replacing the "coming soon" placeholder
// that stood here since 2026-09-08 (real, pre-existing dead nav link — see
// PROJECT_TRACKER.md). Backend already filters to active stories visible to
// this member's own tier (StoriesService.findForMember) — a "preview"-tier
// member (Newsletter/Mongolia) only ever receives stories staff marked
// visible to every tier ("public" stories), never a members-only one, so
// there's nothing further to filter client-side.
export default function NewsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "storiesKnowledge") === "preview";

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; stories: MemberStory[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchMyStories()
      .then((stories) => setState({ status: "loaded", stories }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, []);

  return (
    <RequireAccess area="storiesKnowledge">
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">
          {isPreview ? "News & Stories" : "Stories & Knowledge"}
        </h1>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load stories ({state.message}).
          </p>
        )}

        {state.status === "loaded" && state.stories.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <Newspaper size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">Nothing published yet</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">
              Club news, producer stories, and content from Mongolia will appear here.
            </p>
          </div>
        )}

        {state.status === "loaded" && state.stories.length > 0 && (
          <div className="flex flex-col gap-5">
            {state.stories.map((story) => (
              <article key={story.id} className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
                {story.heroImageUrl && (
                  <div className="relative h-48 w-full">
                    <Image src={story.heroImageUrl} alt="" fill className="object-cover" />
                  </div>
                )}
                <div className="p-6">
                  {story.category && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                      {story.category}
                    </p>
                  )}
                  <h2 className="mt-1 font-serif text-xl tracking-tight text-cashmere-text">{story.title}</h2>
                  {story.quote && (
                    <blockquote className="mt-3 border-l-2 border-cashmere-accent pl-4 text-sm italic text-cashmere-text-muted">
                      &ldquo;{story.quote}&rdquo;
                    </blockquote>
                  )}
                  {story.body && <p className="mt-3 whitespace-pre-line text-sm text-cashmere-text-muted">{story.body}</p>}
                </div>
              </article>
            ))}
          </div>
        )}

        {isPreview && (
          <div className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
            <h2 className="mt-4 font-serif text-xl tracking-tight text-cashmere-text">Become a Member</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-cashmere-text-muted">
              Founding and Annual members get the complete Stories &amp; Knowledge library — producer stories, club
              news and more. Join to see the full library.
            </p>
            <a
              href="/explore-membership"
              className="mt-6 inline-block rounded-full bg-cashmere-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
            >
              Explore Membership
            </a>
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
