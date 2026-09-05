"use client";

import { Droplets, Archive, CircleDot, Scissors, Clock } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";

// Topics are the client's own confirmed list (PROJECT_TRACKER.md Section 3c,
// "Care & Repair"): washing, storage, pilling, simple repairs, longevity.
// Deliberately "structure and templates only for now" per the client's own
// instruction — real guide content is added continuously after launch, so each
// topic ships with an honest "coming soon" body rather than invented care
// instructions. Newsletter/Mongolia get "preview" access per the spec (page 5:
// "Public guides only") — same topic structure, but nudged toward membership
// for the eventual full guides, matching the pattern used elsewhere in the
// portal (e.g. Explore Membership).
const TOPICS = [
  { icon: Droplets, title: "Washing & Cleaning", description: "How to keep cashmere clean without damaging the fibres." },
  { icon: Archive, title: "Storage", description: "Protecting your pieces between seasons." },
  { icon: CircleDot, title: "Pilling", description: "Why it happens, and how to remove it safely." },
  { icon: Scissors, title: "Simple Repairs", description: "Small fixes you can do at home." },
  { icon: Clock, title: "Longevity", description: "Getting the most years out of every piece." },
];

export default function CareRepairPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "careRepair") === "preview";

  return (
    <RequireAccess area="careRepair">
      <div className="flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Care &amp; Repair</h1>
          <p className="mt-1 text-cashmere-text-muted">
            {isPreview
              ? "Public guides for looking after genuine cashmere."
              : "Guides for washing, storing and repairing your cashmere."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-6">
              <Icon size={22} strokeWidth={1.5} className="text-cashmere-accent" />
              <p className="font-medium text-cashmere-text">{title}</p>
              <p className="text-sm text-cashmere-text-muted">{description}</p>
              <p className="mt-auto pt-2 text-xs font-medium uppercase tracking-wide text-cashmere-text-muted">
                Guide coming soon
              </p>
            </div>
          ))}
        </div>

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
