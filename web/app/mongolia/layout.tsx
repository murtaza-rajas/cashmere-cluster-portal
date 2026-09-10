"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { fetchCurrentMember, membershipTierLabel, type Member } from "@/lib/api";
import { MemberProvider } from "@/contexts/member-context";

type Status =
  | { state: "loading" }
  | { state: "ready"; member: Member }
  | { state: "error"; message: string };

// Cashmere Lovers Club Mongolia (client emails 2026-09-07/08/09) — a
// deliberately separate section, not a translated copy of the international
// portal, so it gets its own auth guard and its own shell rather than
// reusing (member)/layout.tsx's Sidebar/Header (built for the international
// visual identity). Real region gate, not just routing convenience: a
// non-Mongolia member landing here directly gets redirected to /dashboard,
// same "must be blocked even via direct URL" discipline as every other
// region/tier-gated area in this app — the API itself enforces this too
// (see members.controller.ts's myMongoliaStories).
//
// This first pass is intentionally a simple header + content shell, not the
// full bottom-tab-bar mobile paradigm shown in the client's mockups
// (Home/Explore/Vote/Offers/Profile) — that's real, named follow-up work
// once more content types (producer profiles, photo archive, voting,
// Mongolia offers) exist to navigate between. See PROJECT_TRACKER.md.
export default function MongoliaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    fetchCurrentMember()
      .then((member) => {
        if (!member) {
          router.replace("/");
          return;
        }
        if (member.region !== "MONGOLIA") {
          router.replace("/dashboard");
          return;
        }
        setStatus({ state: "ready", member });
      })
      .catch((err: Error) => setStatus({ state: "error", message: err.message }));
  }, [router]);

  if (status.state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg">
        <p className="text-cashmere-text-muted">Loading your account…</p>
      </div>
    );
  }

  if (status.state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg">
        <p className="text-red-600">Could not load your account ({status.message}).</p>
      </div>
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  return (
    <MemberProvider member={status.member}>
      <div className="flex min-h-screen flex-col bg-cashmere-bg">
        <header className="flex items-center justify-between border-b border-cashmere-border bg-cashmere-navy px-4 py-4 sm:px-8">
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">Cashmere Lovers Club</p>
            <p className="text-xs uppercase tracking-wide text-white/60">Mongolia</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/80">
            <span className="hidden items-center gap-2 sm:flex">
              <User size={16} strokeWidth={1.75} />
              {status.member.firstName ?? status.member.email} ·{" "}
              {membershipTierLabel(status.member.membershipTier, status.member.isFoundingMember, status.member.region)}
            </span>
            <a href={`${apiUrl}/auth/logout`} className="flex items-center gap-1.5 hover:text-white">
              <LogOut size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">Log out</span>
            </a>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </MemberProvider>
  );
}
