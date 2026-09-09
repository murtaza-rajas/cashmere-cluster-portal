"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarHeart, MapPin, Monitor, Sparkles } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";
import { fetchMyEvents, type MemberEvent } from "@/lib/api";

// Real, staff-curated content (see EventsService / /event-catalog admin) —
// replacing the two hardcoded dummy events the client originally suggested
// (PROJECT_TRACKER.md Section 3c) with real events staff can create/edit.
// Still shows an honest empty state below when staff haven't added any
// events for this member's tier yet, rather than fabricating content.
export default function InvitationsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "invitationsEvents") === "preview";

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; events: MemberEvent[] }
  >({ status: "loading" });

  useEffect(() => {
    if (isPreview) return;
    fetchMyEvents()
      .then((events) => setState({ status: "loaded", events }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [isPreview]);

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
          <p className="mt-1 text-cashmere-text-muted">Exclusive member events.</p>
        </div>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading events…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load events ({state.message}).
          </p>
        )}

        {state.status === "loaded" && state.events.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
            <CalendarHeart size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
            <p className="font-medium text-cashmere-text">No events yet</p>
            <p className="max-w-sm text-sm text-cashmere-text-muted">Check back soon for upcoming member events.</p>
          </div>
        )}

        {state.status === "loaded" && state.events.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {state.events.map((event) => {
              const LocationIcon = event.locationType === "IN_PERSON" ? MapPin : Monitor;
              return (
                <div key={event.id} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-6">
                  <div className="relative h-32 overflow-hidden rounded-xl bg-cashmere-sidebar/60">
                    {event.imageUrl ? (
                      <Image src={event.imageUrl} alt="" fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <CalendarHeart size={32} strokeWidth={1.5} className="text-cashmere-text-muted" />
                      </div>
                    )}
                  </div>
                  <span className="w-fit rounded-full bg-cashmere-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-accent-dark">
                    Exclusive Member Event
                  </span>
                  <p className="font-medium text-cashmere-text">{event.title}</p>
                  {event.description && <p className="text-sm text-cashmere-text-muted">{event.description}</p>}
                  <div className="flex items-center gap-4 border-t border-cashmere-border pt-3 text-xs text-cashmere-text-muted">
                    <span className="flex items-center gap-1">
                      <LocationIcon size={14} strokeWidth={1.75} />
                      {event.locationType === "IN_PERSON" ? event.location || "In person" : event.location || "Online"}
                    </span>
                    <span>{event.startsAt ? new Date(event.startsAt).toLocaleString() : "Date to be announced"}</span>
                  </div>
                  {event.registrationUrl ? (
                    <a
                      href={event.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 w-fit rounded-full bg-cashmere-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
                    >
                      Register
                    </a>
                  ) : (
                    <button
                      disabled
                      className="mt-1 w-fit cursor-not-allowed rounded-full border border-cashmere-border px-4 py-2 text-xs font-medium text-cashmere-text-muted"
                    >
                      Registration opening soon
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
