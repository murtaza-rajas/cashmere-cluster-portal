"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentMember, type Member } from "@/lib/api";
import { MemberProvider } from "@/contexts/member-context";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";

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
          <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </div>
    </MemberProvider>
  );
}
