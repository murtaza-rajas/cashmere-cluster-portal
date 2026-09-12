"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ShieldCheck, ClipboardList, Gift, Image as ImageIcon, ScrollText, CalendarHeart, Wrench, BarChart3, Plug, Palette, Mountain, LogOut, X, ChevronDown, BookOpen, Factory, Images as ImagesIcon, Vote, Globe2, ShoppingBag } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { API_URL } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
  allowedRoles: string[];
  children?: { href: string; label: string; icon: typeof Users }[];
}

// Not run through the role filter below — /staff itself has no @Roles()
// gate (any authenticated staff member can view their own overview), so
// this always shows, unlike every other item here which is gated to
// whichever role(s) its destination actually requires.
const DASHBOARD_ITEM: NavItem = { href: "/staff", label: "Dashboard", icon: LayoutDashboard, allowedRoles: [] };

// 2026-09-11 — Mongolia restructured from one tabbed page into a nested
// section (client's own mockup, `mongolia-admin-interface.png`), so the
// Mongolia Editor role (added same day — the first regional/community
// role, see api/src/staff/region-scope.util.ts) can be scoped to just
// these sub-items without touching the rest of CLC admin. Every child page
// below checks for "Content Manager"/"Event Manager"/"Club Manager"/
// "Member Support" OR "Mongolia Editor" — same backend role gates as their
// international counterparts, just with the regional role added.
const MONGOLIA_CHILDREN = [
  { href: "/staff/mongolia", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/mongolia/stories", label: "Stories & News", icon: BookOpen },
  { href: "/staff/mongolia/producers", label: "Producers", icon: Factory },
  { href: "/staff/mongolia/photos", label: "Photo Archive", icon: ImagesIcon },
  { href: "/staff/mongolia/voting", label: "Your Voice / Voting", icon: Vote },
  { href: "/staff/mongolia/offers", label: "Current Offers", icon: Gift },
  { href: "/staff/mongolia/world", label: "Mongolia and the World", icon: Globe2 },
  { href: "/staff/mongolia/events", label: "Events", icon: CalendarHeart },
  { href: "/staff/mongolia/membership", label: "Membership Access", icon: Users },
];

const NAV_ITEMS: NavItem[] = [
  { href: "/staff/directory", label: "Staff & Roles", icon: ShieldCheck, allowedRoles: ["Super Administrator"] },
  { href: "/staff/members", label: "Members & Users", icon: Users, allowedRoles: ["Club Manager", "Member Support"] },
  { href: "/staff/benefits", label: "Offers & Benefits", icon: Gift, allowedRoles: ["Club Manager"] },
  { href: "/staff/images", label: "Site Images", icon: ImageIcon, allowedRoles: ["Club Manager", "Content Manager"] },
  { href: "/staff/events", label: "Events & Invitations", icon: CalendarHeart, allowedRoles: ["Event Manager"] },
  { href: "/staff/care-repair", label: "Care & Repair", icon: Wrench, allowedRoles: ["Content Manager"] },
  { href: "/staff/design-lab", label: "Design Lab", icon: Palette, allowedRoles: ["Content Manager"] },
  { href: "/staff/mongolia", label: "Mongolia", icon: Mountain, allowedRoles: ["Content Manager", "Mongolia Editor"], children: MONGOLIA_CHILDREN },
  { href: "/staff/data-requests", label: "GDPR Requests", icon: ClipboardList, allowedRoles: ["Super Administrator", "Member Support"] },
  { href: "/staff/audit-log", label: "Audit Log", icon: ScrollText, allowedRoles: ["Super Administrator"] },
  { href: "/staff/reports", label: "Reports & Analytics", icon: BarChart3, allowedRoles: ["Analytics Viewer"] },
  { href: "/staff/orders", label: "Shopify & Orders", icon: ShoppingBag, allowedRoles: ["Commerce Manager"] },
  { href: "/staff/integrations", label: "Integrations & Settings", icon: Plug, allowedRoles: ["Technical Administrator"] },
];

export default function StaffSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const staff = useStaff();
  const navItems = NAV_ITEMS.filter((item) => staffHasAnyRole(staff, item.allowedRoles));
  // Auto-expand a group whenever the current page is inside it, so landing
  // directly on e.g. /staff/mongolia/stories doesn't hide its own nav.
  const [expanded, setExpanded] = useState<string | null>(
    navItems.find((item) => item.children && pathname.startsWith(item.href))?.href ?? null,
  );

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
            {[DASHBOARD_ITEM, ...navItems].map((item) => {
              const { href, label, icon: Icon } = item;
              const children = item.children;
              const active = pathname === href;

              if (!children) {
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
              }

              const isExpanded = expanded === href;
              const childActive = pathname.startsWith(href);
              return (
                <div key={href}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : href)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      childActive ? "bg-white/10 font-medium text-white" : "text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.75}
                      className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                      {children.map((child) => {
                        const childIsActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                              childIsActive ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5"
                            }`}
                          >
                            <child.icon size={15} strokeWidth={1.75} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
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
