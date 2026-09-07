"use client";

import { Newspaper, Sparkles } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";

// Real pre-existing gap, not new scope: both sidebars (components/sidebar.tsx)
// have always linked here ("Stories & Knowledge" / "News & Stories") with no
// page behind it — a dead link until now. Content itself stays blocked on the
// same open architecture decision as everything else in this area (Strapi vs.
// a simple DB-backed v1 vs. reusing the existing WordPress blog — see
// PROJECT_TRACKER.md) — this is the honest placeholder, not the real feature.
export default function NewsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "storiesKnowledge") === "preview";

  if (isPreview) {
    return (
      <RequireAccess area="storiesKnowledge">
        <div className="flex max-w-2xl flex-col gap-6">
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">News &amp; Stories</h1>
          <div className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
            <h2 className="mt-4 font-serif text-xl tracking-tight text-cashmere-text">Become a Member</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-cashmere-text-muted">
              Founding and Annual members get the complete Stories &amp; Knowledge library — producer stories,
              club news and more. Join to see the full library.
            </p>
            <a
              href="/explore-membership"
              className="mt-6 inline-block rounded-full bg-cashmere-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
            >
              Explore Membership
            </a>
          </div>
        </div>
      </RequireAccess>
    );
  }

  return (
    <RequireAccess area="storiesKnowledge">
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Stories &amp; Knowledge</h1>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <Newspaper size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <p className="font-medium text-cashmere-text">Stories &amp; Knowledge coming soon</p>
          <p className="max-w-sm text-sm text-cashmere-text-muted">
            Club news, producer stories, and content from Mongolia will appear here.
          </p>
        </div>
      </div>
    </RequireAccess>
  );
}
