"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentMember, type Member } from "@/lib/api";
import { MemberProvider } from "@/contexts/member-context";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import BottomTabBar from "@/components/bottom-tab-bar";

type Status =
  | { state: "loading" }
  | { state: "ready"; member: Member }
  | { state: "error"; message: string };

// Auth guard for every route under (member)/ — checks the session once here so
// individual pages (dashboard, profile, orders, ...) don't each need their own
// fetch-and-redirect boilerplate. Redirects to "/" (the sign-in page) on no session,
// matching the pattern already verified working there.
export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchCurrentMember()
      .then((member) => {
        if (!member) {
          router.replace("/");
          return;
        }
        // Region-driven section split (client email 2026-09-08: "the
        // simplest practical solution" — not full translation, just
        // routing). Cashmere Lovers Club Mongolia is a deliberately
        // separate section (its own nav, its own content), not a reskin of
        // the international portal, so a Mongolia-region member never sees
        // this layout at all — same "land in the Mongolia-themed section"
        // behavior for every route under here, not just the dashboard.
        if (member.region === "MONGOLIA") {
          router.replace("/mongolia");
          return;
        }
        setStatus({ state: "ready", member });
      })
      .catch((err: Error) =>
        setStatus({ state: "error", message: err.message }),
      );
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
        <p className="text-red-600">
          Could not load your account ({status.message}).
        </p>
      </div>
    );
  }

  return (
    <MemberProvider member={status.member}>
      <div className="flex min-h-screen bg-cashmere-bg">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          {/* pb-24 reserves room for BottomTabBar (mobile only, fixed) so the
              last section of a page's content is never hidden behind it. */}
          <main className="flex-1 px-4 py-6 pb-24 sm:px-8 sm:py-8 md:pb-8">{children}</main>
        </div>
        <BottomTabBar />
      </div>
    </MemberProvider>
  );
}
