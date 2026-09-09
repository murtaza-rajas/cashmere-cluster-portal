"use client";

import Link from "next/link";
import { ShieldCheck, ClipboardList, Users, Gift, Image as ImageIcon, ScrollText, CalendarHeart, Wrench, BarChart3, Plug } from "lucide-react";
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
        {staffHasAnyRole(staff, ["Club Manager", "Member Support"]) && (
          <Link
            href="/staff/members"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <Users size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Members &amp; Users</p>
              <p className="text-sm text-cashmere-text-muted">Look up a member&apos;s profile, orders and activity</p>
            </div>
          </Link>
        )}
        {staffHasAnyRole(staff, ["Club Manager"]) && (
          <Link
            href="/staff/benefits"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <Gift size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Offers &amp; Benefits</p>
              <p className="text-sm text-cashmere-text-muted">Manage My Benefits and Member Offers content</p>
            </div>
          </Link>
        )}
        {staffHasAnyRole(staff, ["Club Manager", "Content Manager"]) && (
          <Link
            href="/staff/images"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <ImageIcon size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Site Images</p>
              <p className="text-sm text-cashmere-text-muted">Upload tier-specific hero photos</p>
            </div>
          </Link>
        )}
        {staffHasAnyRole(staff, ["Event Manager"]) && (
          <Link
            href="/staff/events"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <CalendarHeart size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Events &amp; Invitations</p>
              <p className="text-sm text-cashmere-text-muted">Create and manage member events</p>
            </div>
          </Link>
        )}
        {staffHasAnyRole(staff, ["Content Manager"]) && (
          <Link
            href="/staff/care-repair"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <Wrench size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Care &amp; Repair</p>
              <p className="text-sm text-cashmere-text-muted">Edit the Care &amp; Repair guide text</p>
            </div>
          </Link>
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
        {staffHasAnyRole(staff, ["Super Administrator"]) && (
          <Link
            href="/staff/audit-log"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <ScrollText size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Audit Log</p>
              <p className="text-sm text-cashmere-text-muted">Review every sensitive administrative action</p>
            </div>
          </Link>
        )}
        {staffHasAnyRole(staff, ["Analytics Viewer"]) && (
          <Link
            href="/staff/reports"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <BarChart3 size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Reports &amp; Analytics</p>
              <p className="text-sm text-cashmere-text-muted">Member totals, tiers, growth and order KPIs</p>
            </div>
          </Link>
        )}
        {staffHasAnyRole(staff, ["Technical Administrator"]) && (
          <Link
            href="/staff/integrations"
            className="flex items-center gap-3 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent/40"
          >
            <Plug size={20} strokeWidth={1.5} className="text-cashmere-accent" />
            <div>
              <p className="font-medium text-cashmere-text">Integrations &amp; Settings</p>
              <p className="text-sm text-cashmere-text-muted">Shopify, database and connection status</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
