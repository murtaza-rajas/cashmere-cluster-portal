"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ShieldCheck, ClipboardList, LogOut, X } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { API_URL } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
  allowedRoles: string[];
}

// Only two admin areas exist yet — both fully backed by real endpoints already
// built in earlier Milestone 5 backend work. "Members & Users" and "Audit Log"
// are real gaps (no admin-facing list/search endpoint or audit-log read
// endpoint exists yet), not built here — see PROJECT_TRACKER.md.
const NAV_ITEMS: NavItem[] = [
  { href: "/staff/directory", label: "Staff & Roles", icon: ShieldCheck, allowedRoles: ["Super Administrator"] },
  { href: "/staff/data-requests", label: "GDPR Requests", icon: ClipboardList, allowedRoles: ["Super Administrator", "Member Support"] },
];

export default function StaffSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const staff = useStaff();
  const navItems = NAV_ITEMS.filter((item) => staffHasAnyRole(staff, item.allowedRoles));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between border-r border-cashmere-border bg-cashmere-navy px-4 py-6 transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-start justify-between px-2 pb-8">
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">Cashmere House</p>
              <p className="text-xs uppercase tracking-wide text-white/60">Admin Portal</p>
            </div>
            <button onClick={onClose} className="text-white/60 md:hidden" aria-label="Close menu">
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.length === 0 && (
              <p className="px-3 py-2 text-sm text-white/50">No admin areas available for your role.</p>
            )}
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-white/10 font-medium text-white" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </Link>
              );
            })}

            <a
              href={`${API_URL}/auth/staff/logout`}
              className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5"
            >
              <LogOut size={18} strokeWidth={1.75} />
              Log out
            </a>
          </nav>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent">{staff.name}</p>
          <p className="mt-1 text-white/60">{staff.roles.join(", ") || "No roles assigned"}</p>
        </div>
      </aside>
    </>
  );
}
