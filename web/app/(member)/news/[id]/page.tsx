"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Newspaper, Palette } from "lucide-react";
import { RequireAccess } from "@/components/require-access";
import { fetchMyStories, fetchMyStoryPreviews, fetchMyDesigns, MemberStory, MemberStoryPreview, MemberDesign } from "@/lib/api";
import { LockBadge, membersWhoCanAccess } from "@/components/locked-content";
import { useMember } from "@/contexts/member-context";
import { getAccessLevel } from "@/lib/access";
import { StoryArticle } from "@/components/story-article";

// Individual story page — added for Designer Spotlight (client go-ahead,
// 2026-09-15), whose own mockup is a dedicated article page with a
// breadcrumb ("Home > News & Updates > Designer Spotlight: Cansel"), not
// just another card on the /news list. Every story gets this same detail
// page, not just spotlights — reuses the same already-tier-filtered
// GET /members/me/stories list (no new backend endpoint) rather than
// fetching by id server-side, since the list is already the source of
// truth for what this member is allowed to see.
//
// Explicit client instruction, followed exactly: "we should not display
// public vote counts, rankings or other competitive metrics" — the
// designer's latest-concepts grid below shows title and photo only, never
// favoriteCount/voteCount, even though the Design Lab API returns them.
export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const member = useMember();
  const hasDesignLabAccess = getAccessLevel(member.membershipTier, "designLab") !== "none";

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "not-found" }
    | { status: "locked"; preview: MemberStoryPreview }
    | { status: "loaded"; story: MemberStory }
  >({ status: "loading" });
  const [concepts, setConcepts] = useState<MemberDesign[] | null>(null);

  useEffect(() => {
    fetchMyStories()
      .then(async (stories) => {
        const story = stories.find((s) => s.id === id);
        if (story) return setState({ status: "loaded", story });
        // Not readable at this level — if it's a member-only story, show its
        // teaser and how to unlock it instead of "not found".
        const preview = (await fetchMyStoryPreviews()).find((p) => p.id === id && p.locked);
        setState(preview ? { status: "locked", preview } : { status: "not-found" });
      })
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [id]);

  useEffect(() => {
    if (state.status !== "loaded" || !state.story.designerName || !hasDesignLabAccess) return;
    const designerName = state.story.designerName;
    fetchMyDesigns()
      .then((designs) => setConcepts(designs.filter((d) => d.designerName === designerName)))
      .catch(() => setConcepts([]));
  }, [state, hasDesignLabAccess]);

  return (
    <RequireAccess area="storiesKnowledge">
      <div className="flex w-full flex-col gap-6">
        <Link
          href="/news"
          className="flex w-fit items-center gap-1 text-sm text-cashmere-text-muted hover:text-cashmere-text"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Stories &amp; Knowledge
        </Link>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load this story ({state.message}).
          </p>
        )}
        {state.status === "not-found" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <Newspaper size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">Story not found</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">
              It may have been unpublished, or isn&apos;t visible to your membership level.
            </p>
          </div>
        )}

        {state.status === "locked" && (
          <article className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
            {state.preview.heroImageUrl && (
              <div className="relative aspect-[16/7] w-full">
                <Image src={state.preview.heroImageUrl} alt="" fill className="object-cover" />
                <LockBadge className="absolute top-4 right-4 h-9 w-9" />
              </div>
            )}
            <div className="flex flex-col gap-3 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                {state.preview.category.name}
              </p>
              <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">{state.preview.title}</h1>
              {state.preview.excerpt && <p className="max-w-[65ch] text-cashmere-text-muted">{state.preview.excerpt}</p>}
              <div className="mt-4 rounded-xl bg-cashmere-sidebar/70 p-5 text-center">
                <p className="font-medium text-cashmere-text">
                  This story is available to {membersWhoCanAccess(state.preview.availableTo)}.
                </p>
                <Link
                  href="/explore-membership"
                  className="mt-4 inline-block rounded-full bg-cashmere-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
                >
                  Explore Membership
                </Link>
              </div>
            </div>
          </article>
        )}

        {state.status === "loaded" && (
          <div className="flex flex-col gap-6">
            <StoryArticle
              story={{
                title: state.story.title,
                heroImageUrl: state.story.heroImageUrl,
                categoryName: state.story.category.name,
                designerName: state.story.designerName,
                sections: state.story.sections,
              }}
            />

            {state.story.designerName && hasDesignLabAccess && (
              <div className="rounded-2xl border border-cashmere-border bg-white p-8">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl tracking-tight text-cashmere-text">
                    {state.story.designerName}&apos;s latest concepts in the Design Lab
                  </h2>
                  <Link
                    href="/design-lab"
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-cashmere-accent hover:underline"
                  >
                    View all designs <ArrowRight size={12} />
                  </Link>
                </div>

                {concepts === null ? (
                  <p className="mt-4 text-sm text-cashmere-text-muted">Loading…</p>
                ) : concepts.length === 0 ? (
                  <p className="mt-4 text-sm text-cashmere-text-muted">
                    No Design Lab concepts from {state.story.designerName} yet.
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {concepts.slice(0, 3).map((d) => (
                      <Link key={d.id} href="/design-lab" className="group flex flex-col gap-2">
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                          {d.heroImageUrl ? (
                            <Image
                              src={d.heroImageUrl}
                              alt=""
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Palette size={24} strokeWidth={1.5} className="text-cashmere-text-muted" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium text-cashmere-text">{d.title}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
