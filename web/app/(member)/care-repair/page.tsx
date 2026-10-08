"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Droplets, Archive, CircleDot, Scissors, Clock, X } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";
import { fetchMySiteImages, fetchMyCareGuides, type CareGuide } from "@/lib/api";
import { renderSimpleMarkdown } from "@/lib/simple-markdown";

// Topics are the client's own confirmed list (PROJECT_TRACKER.md Section 3c,
// "Care & Repair"): washing, storage, pilling, simple repairs, longevity —
// deliberately fixed, not staff-creatable (see api/src/care-guides' comment).
// "Structure and templates only for now" per the client's own instruction —
// real guide content ("body" below, staff-editable at /staff/care-repair) is
// added continuously after launch, so a topic with no body yet still shows
// an honest "coming soon" state rather than invented care instructions.
// Newsletter/Mongolia get "preview" access per the spec (page 5: "Public
// guides only") — same topic structure, but nudged toward membership for
// the eventual full guides, matching the pattern used elsewhere in the portal
// (e.g. Explore Membership).
const TOPICS: { topic: CareGuide["topic"]; icon: typeof Droplets; title: string; description: string }[] = [
  { topic: "WASHING", icon: Droplets, title: "Washing & Cleaning", description: "How to keep cashmere clean without damaging the fibres." },
  { topic: "STORAGE", icon: Archive, title: "Storage", description: "Protecting your pieces between seasons." },
  { topic: "PILLING", icon: CircleDot, title: "Pilling", description: "Why it happens, and how to remove it safely." },
  { topic: "REPAIRS", icon: Scissors, title: "Simple Repairs", description: "Small fixes you can do at home." },
  { topic: "LONGEVITY", icon: Clock, title: "Longevity", description: "Getting the most years out of every piece." },
];

const DEFAULT_CARE_REPAIR_HERO = "/images/care-repair-hero.jpeg";

export default function CareRepairPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "careRepair") === "preview";
  const [heroSrc, setHeroSrc] = useState(DEFAULT_CARE_REPAIR_HERO);
  const [guides, setGuides] = useState<Record<string, string | null>>({});
  const [expandedTopic, setExpandedTopic] = useState<CareGuide["topic"] | null>(null);

  useEffect(() => {
    // Staff-uploaded, tier-specific hero photo (Milestone 5) — falls back to
    // the bundled default above for any tier staff haven't set one for yet.
    fetchMySiteImages()
      .then((images) => {
        if (images.CARE_REPAIR_HERO) setHeroSrc(images.CARE_REPAIR_HERO);
      })
      .catch(() => undefined);
    // Staff-written guide text (Milestone 5, /staff/care-repair) — a topic
    // with no body yet keeps the "Guide coming soon" placeholder below.
    fetchMyCareGuides()
      .then((rows) => setGuides(Object.fromEntries(rows.map((r) => [r.topic, r.body]))))
      .catch(() => undefined);
  }, []);

  return (
    <RequireAccess area="careRepair">
      <div className="flex w-full flex-col gap-6">
        {/* Real photo (2026-09-08, public/images/care-repair-hero.jpeg — one of
            the client's supplied images) as the default; staff can override
            it per tier via /staff/images without a code change. */}
        <div className="relative h-40 overflow-hidden rounded-2xl sm:h-52">
          <Image src={heroSrc} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-cashmere-navy/70 via-cashmere-navy/10 to-transparent" />
          <div className="absolute right-0 bottom-0 left-0 p-6">
            <h1 className="font-serif text-3xl tracking-tight text-white">Care &amp; Repair</h1>
            <p className="mt-1 text-white/85">
              {isPreview
                ? "Public guides for looking after genuine cashmere."
                : "Guides for washing, storing and repairing your cashmere."}
            </p>
          </div>
        </div>

        {/* Each card stays a short, scannable teaser regardless of how long
            the real guide is (client email 2026-10-08: readable even for
            "those who aren't keen on reading long blocks of text") — the
            full guide opens below on demand instead of being crammed into a
            fixed-width grid cell. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(({ topic, icon: Icon, title, description }) => {
            const body = guides[topic];
            const isExpanded = expandedTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                disabled={!body}
                onClick={() => setExpandedTopic(isExpanded ? null : topic)}
                className={`flex flex-col items-start gap-3 rounded-2xl border bg-white p-6 text-left transition-colors ${
                  isExpanded ? "border-cashmere-accent ring-1 ring-cashmere-accent" : "border-cashmere-border"
                } ${body ? "cursor-pointer hover:border-cashmere-accent" : "cursor-default"}`}
              >
                <Icon size={22} strokeWidth={1.5} className="text-cashmere-accent" />
                <p className="font-medium text-cashmere-text">{title}</p>
                <p className="text-sm text-cashmere-text-muted">{description}</p>
                {body ? (
                  <span className="mt-auto pt-2 text-xs font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                    {isExpanded ? "Hide guide" : "Read full guide →"}
                  </span>
                ) : (
                  <span className="mt-auto pt-2 text-xs font-medium uppercase tracking-wide text-cashmere-text-muted">
                    Guide coming soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Full-width reading view — generous line length/spacing, real
            headings from the staff-written content, matching the same
            readability principles as the Stories & Knowledge rework
            (client's National Geographic reference, 2026-10-07). */}
        {expandedTopic && guides[expandedTopic] && (
          <div className="rounded-2xl border border-cashmere-border bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-serif text-2xl tracking-tight text-cashmere-text">
                {TOPICS.find((t) => t.topic === expandedTopic)?.title}
              </h2>
              <button
                type="button"
                onClick={() => setExpandedTopic(null)}
                aria-label="Close guide"
                className="shrink-0 rounded-full p-1.5 text-cashmere-text-muted hover:bg-cashmere-border/60"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="mt-4 flex max-w-[65ch] flex-col gap-4">
              {renderSimpleMarkdown(guides[expandedTopic]!)}
            </div>
          </div>
        )}

        {isPreview && (
          <div className="rounded-2xl border border-cashmere-border bg-cashmere-sidebar/60 p-6 text-center">
            <p className="font-medium text-cashmere-text">Become a Member for the complete Care &amp; Repair library</p>
            <a
              href="/explore-membership"
              className="mt-4 inline-block rounded-full bg-cashmere-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
            >
              Explore Membership
            </a>
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
