"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Tag,
  ShoppingBag,
  Package,
  Shirt,
  Heart,
  CalendarHeart,
  Newspaper,
  Wrench,
  Gift,
  User,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { membershipTierLabel } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/member-offers", label: "Member Offers", icon: Tag, badge: "NEW" },
  { href: "/exclusive-collections", label: "Exclusive Collections", icon: ShoppingBag },
  { href: "/orders", label: "My Orders", icon: Package },
  { href: "/collection", label: "My Collection", icon: Shirt },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/invitations", label: "Invitations & Events", icon: CalendarHeart },
  { href: "/news", label: "News & Updates", icon: Newspaper },
  { href: "/care-repair", label: "Care & Repair", icon: Wrench },
  { href: "/benefits", label: "My Benefits", icon: Gift },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help & Support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const member = useMember();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-cashmere-border bg-cashmere-sidebar px-4 py-6">
      <div>
        <div className="px-2 pb-8">
          <p className="text-lg font-semibold tracking-tight text-cashmere-text">Cashmere House</p>
          <p className="text-xs uppercase tracking-wide text-cashmere-text-muted">Cashmere Lovers Club</p>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-cashmere-accent/15 font-medium text-cashmere-accent-dark"
                    : "text-cashmere-text hover:bg-cashmere-border/60"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="rounded-full bg-cashmere-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          <a
            href={`${apiUrl}/auth/logout`}
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-cashmere-text-muted hover:bg-cashmere-border/60"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Log out
          </a>
        </nav>
      </div>

      {member.isFoundingMember && (
        <div className="rounded-lg border border-cashmere-border bg-white/60 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent-dark">
            {membershipTierLabel(member.membershipTier, member.isFoundingMember)}
          </p>
          <p className="mt-1 text-cashmere-text-muted">Thank you for being part of something truly special.</p>
        </div>
      )}
    </aside>
  );
}
