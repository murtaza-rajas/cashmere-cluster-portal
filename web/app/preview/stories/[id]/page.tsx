"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchCurrentStaff, fetchStoryCatalog, StaffStory } from "@/lib/staff-api";
import { StoryArticle } from "@/components/story-article";

// "Preview" button target (client request 2026-10-05, option 1 of 2 offered —
// see PROJECT_TRACKER.md). Opens in a new tab from the Stories & Knowledge
// editor. Deliberately a top-level route, NOT nested under /staff/* — every
// page under /staff/* is wrapped in the staff sidebar/header by
// app/staff/layout.tsx, which would defeat the point of "show exactly what a
// member would see." This page does its own staff-session check instead
// (same fetchCurrentStaff() used there) and renders nothing but the real
// article, via the same <StoryArticle> component app/(member)/news/[id]
// uses — so it stays accurate automatically as that rendering evolves, and
// resizing the window covers "check mobile and desktop" without a dedicated
// toggle (the fuller split-pane version was the other, deferred option).
//
// Works for drafts, not just published stories — fetches via the staff
// catalog (every status), not the member-facing feed, which is deliberately
// PUBLISHED-only.
export default function StoryPreviewPage() {
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<
    | { status: "checking-auth" }
    | { status: "signed-out" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "not-found" }
    | { status: "loaded"; story: StaffStory }
  >({ status: "checking-auth" });

  useEffect(() => {
    fetchCurrentStaff()
      .then((staff) => {
        if (!staff) {
          setState({ status: "signed-out" });
          return;
        }
        setState({ status: "loading" });
        fetchStoryCatalog()
          .then((stories) => {
            const story = stories.find((s) => s.id === id);
            setState(story ? { status: "loaded", story } : { status: "not-found" });
          })
          .catch((err: Error) => setState({ status: "error", message: err.message }));
      })
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [id]);

  if (state.status === "checking-auth") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg">
        <p className="text-cashmere-text-muted">Checking staff session…</p>
      </div>
    );
  }

  if (state.status === "signed-out") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg px-6 text-center">
        <p className="text-cashmere-text-muted">
          Staff sign-in required to preview this. Open this link from the Stories &amp; Knowledge editor.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cashmere-bg">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-cashmere-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-cashmere-accent-dark">
          <span>Preview — this is what members see, not how staff pages are styled</span>
          <Link href="/staff/stories" className="flex shrink-0 items-center gap-1 normal-case hover:underline">
            <ArrowLeft size={12} /> Back to editor
          </Link>
        </div>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load this story ({state.message}).
          </p>
        )}
        {state.status === "not-found" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Story not found — it may have been deleted since this preview was opened.
          </p>
        )}

        {state.status === "loaded" && (
          <StoryArticle
            story={{
              title: state.story.title,
              heroImageUrl: state.story.heroImageUrl,
              categoryName: state.story.category.name,
              designerName: state.story.designerName,
              sections: state.story.sections,
            }}
          />
        )}
      </div>
    </div>
  );
}
