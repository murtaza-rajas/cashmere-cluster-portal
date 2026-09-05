"use client";

import { ShieldCheck, ClipboardList } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";

export default function StaffHomePage() {
  const staff = useStaff();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Welcome, {staff.name}</h1>
        <p className="mt-1 text-cashmere-text-muted">{staff.roles.join(", ") || "No roles assigned yet"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {staffHasAnyRole(staff, ["Super Administrator"]) && (
          <a
            href="/staff/directory"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <ShieldCheck size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Staff &amp; Roles</p>
              <p className="text-sm text-cashmere-text-muted">Create staff accounts, grant or revoke roles</p>
            </div>
          </a>
        )}
        {staffHasAnyRole(staff, ["Super Administrator", "Member Support"]) && (
          <a
            href="/staff/data-requests"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <ClipboardList size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">GDPR Requests</p>
              <p className="text-sm text-cashmere-text-muted">Review and complete pending member data requests</p>
            </div>
          </a>
        )}
      </div>
    </div>
  );
}
