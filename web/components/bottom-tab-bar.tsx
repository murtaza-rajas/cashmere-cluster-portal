"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tag, Shirt, Newspaper, User, Heart, Package } from "lucide-react";
import { useMember } from "@/contexts/member-context";

interface TabItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// Mobile-only primary navigation, matching the client's own mobile mockup
// (2.2 Fouder member Mobli.png / 2.5 CLC MN Founder Mobil.png — both show a
// bottom tab bar alongside the hamburger menu, not instead of it). The
// hamburger's full Sidebar overlay stays the only way to reach everything
// else — this is deliberately a curated subset (5 items, matching the
// mockup's own count), not a second copy of the full nav. Desktop is
// unaffected: the existing sidebar is already the primary nav there.
const FULL_TABS: TabItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/member-offers", label: "Offers", icon: Tag },
  { href: "/collection", label: "Collection", icon: Shirt },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/profile", label: "Profile", icon: User },
];

// Newsletter/Mongolia's own real nav (components/sidebar.tsx's NEWSLETTER_NAV_ITEMS)
// doesn't include Member Offers/My Collection at all — Wishlist and My Orders
// are what those members actually have, so the mobile tab bar mirrors that
// instead of reusing the full-tier set with dead links.
const NEWSLETTER_TABS: TabItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const member = useMember();
  const tabs = member.membershipTier === "FOUNDING" || member.membershipTier === "ANNUAL" ? FULL_TABS : NEWSLETTER_TABS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-cashmere-border bg-cashmere-bg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              active ? "text-cashmere-accent" : "text-cashmere-text-muted"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
