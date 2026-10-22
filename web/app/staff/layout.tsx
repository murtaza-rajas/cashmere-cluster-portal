"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCurrentStaff } from "@/lib/staff-api";
import type { StaffUser } from "@/lib/staff-api";
import { StaffProvider } from "@/contexts/staff-context";
import StaffSidebar from "@/components/staff-sidebar";
import StaffHeader from "@/components/staff-header";
import { StaffSignIn } from "@/components/staff-sign-in";

type Status =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "ready"; staff: StaffUser }
  | { state: "error"; message: string };

// Auth guard for every route under /staff/*. With no staff session it shows
// the Admin sign-in (emailed 6-digit code, 2026-10-22) in place of the page,
// then loads the requested page once signed in. Preview links still work.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadStaff = useCallback(() => {
    fetchCurrentStaff()
      .then((staff) => {
        setStatus(staff ? { state: "ready", staff } : { state: "signed-out" });
      })
      .catch((err: Error) => setStatus({ state: "error", message: err.message }));
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  if (status.state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cashmere-bg">
        <p className="text-cashmere-text-muted">Checking staff session…</p>
      </div>
    );
  }

  if (status.state === "signed-out") {
    return <StaffSignIn onSignedIn={loadStaff} />;
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
