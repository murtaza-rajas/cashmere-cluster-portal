"use client";

import { CalendarHeart, MapPin, Monitor, Sparkles } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";

// Two dummy events, exactly as the client suggested (PROJECT_TRACKER.md
// Section 3c, "Events") — deliberately simple for Phase 1, "under development"
// messaging is acceptable. Fields match what the client asked for: image,
// title, date/time, location-or-online, description, eligible tiers,
// registration link. Registration has no real link yet (client: "just an
// external link for Phase 1" — none supplied), so it's shown as an honest
// "opening soon" state rather than a fabricated URL. No real event photography
// exists yet — an icon placeholder stands in, same pattern as My Collection.
//
// Not built yet, flagged rather than guessed at: the client also asked for
// this dummy event to "work in Mongolian" — no verified Mongolian translation
// of this copy exists, so this ships English-only for now rather than
// presenting an unverified machine translation as real content.
const EVENTS = [
  {
    icon: MapPin,
    title: "Mongolia Evening — Meet the Producers",
    when: "Date to be announced",
    where: "In person",
    description: "An evening with the herders and artisans behind your cashmere, direct from Mongolia.",
  },
  {
    icon: Monitor,
    title: "Meet the Designer",
    when: "Date to be announced",
    where: "Online",
    description: "A live digital session with our design team on the inspiration behind the collection.",
  },
];

export default function InvitationsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "invitationsEvents") === "preview";

  if (isPreview) {
    return (
      <RequireAccess area="invitationsEvents">
        <div className="flex max-w-2xl flex-col gap-6">
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Invitations &amp; Events</h1>
          <div className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
            <h2 className="mt-4 font-serif text-xl tracking-tight text-cashmere-text">Become a Member</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-cashmere-text-muted">
              Founding and Annual members get invitations to exclusive events, launches and previews. Join to see
              what&apos;s coming up.
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
    <RequireAccess area="invitationsEvents">
      <div className="flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Invitations &amp; Events</h1>
          <p className="mt-1 text-cashmere-text-muted">Exclusive member events — under development, more to come.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EVENTS.map(({ icon: Icon, title, when, where, description }) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-6">
              <div className="flex h-32 items-center justify-center rounded-xl bg-cashmere-sidebar/60">
                <CalendarHeart size={32} strokeWidth={1.5} className="text-cashmere-text-muted" />
              </div>
              <span className="w-fit rounded-full bg-cashmere-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                Exclusive Member Event
              </span>
              <p className="font-medium text-cashmere-text">{title}</p>
              <p className="text-sm text-cashmere-text-muted">{description}</p>
              <div className="flex items-center gap-4 border-t border-cashmere-border pt-3 text-xs text-cashmere-text-muted">
                <span className="flex items-center gap-1">
                  <Icon size={14} strokeWidth={1.75} />
                  {where}
                </span>
                <span>{when}</span>
              </div>
              <button
                disabled
                className="mt-1 w-fit cursor-not-allowed rounded-full border border-cashmere-border px-4 py-2 text-xs font-medium text-cashmere-text-muted"
              >
                Registration opening soon
              </button>
            </div>
          ))}
        </div>
      </div>
    </RequireAccess>
  );
}
