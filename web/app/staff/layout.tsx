"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { fetchCurrentStaff } from "@/lib/staff-api";
import type { StaffUser } from "@/lib/staff-api";
import { StaffProvider } from "@/contexts/staff-context";
import StaffSidebar from "@/components/staff-sidebar";
import StaffHeader from "@/components/staff-header";

type Status =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "ready"; staff: StaffUser }
  | { state: "error"; message: string };

// Auth guard for every route under /staff/*. Unlike the member layout, this
// does NOT redirect to a login page on no session — no real staff sign-in flow
// exists yet (StaffJwtStrategy is a deliberate placeholder, see its own
// comments, pending the Milestone 1 identity-provider decision). Rather than
// build a fake login form that would conflict with the "no passwords stored"
// architecture, this shows an honest explanation instead.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchCurrentStaff()
      .then((staff) => {
        setStatus(staff ? { state: "ready", staff } : { state: "signed-out" });
      })
      .catch((err: Error) => setStatus({ state: "error", message: err.message }));
  }, []);

  if (status.state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg">
        <p className="text-cashmere-text-muted">Checking staff session…</p>
      </div>
    );
  }

  if (status.state === "signed-out") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cashmere-bg px-6 text-center">
        <ShieldAlert size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
        <p className="font-medium text-cashmere-text">Staff sign-in isn&apos;t built yet</p>
        <p className="max-w-sm text-sm text-cashmere-text-muted">
          Real staff authentication is still pending a Milestone 1 decision (magic link, SSO, or passkeys). Ask
          engineering for a development session token in the meantime.
        </p>
      </div>
    );
  }

  if (status.state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg">
        <p className="text-red-600">Could not load your staff session ({status.message}).</p>
      </div>
    );
  }

  return (
    <StaffProvider staff={status.staff}>
      <div className="flex min-h-screen bg-cashmere-bg">
        <StaffSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <StaffHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </div>
    </StaffProvider>
  );
}
