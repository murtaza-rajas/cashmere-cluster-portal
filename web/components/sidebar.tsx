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
  X,
  Home,
  Sparkles,
  Mail,
} from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { membershipTierLabel } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

// Founding/Annual navigation — per cashmere-lovers-club-access-administration-model
// PDF, page 6 ("Navigation menus"). Founding and Annual share this same set of
// links (the PDF differs only on a couple of labels between them, e.g. "Exclusive
// Collections" vs "Collections" — not functionally different, not worth splitting
// into two lists for a label nuance).
const FULL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/member-offers", label: "Member Offers", icon: Tag, badge: "NEW" },
  {
    href: "/exclusive-collections",
    label: "Exclusive Collections",
    icon: ShoppingBag,
  },
  { href: "/orders", label: "My Orders", icon: Package },
  { href: "/collection", label: "My Collection", icon: Shirt },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/invitations", label: "Invitations & Events", icon: CalendarHeart },
  { href: "/news", label: "Stories & Knowledge", icon: Newspaper },
  { href: "/care-repair", label: "Care & Repair", icon: Wrench },
  { href: "/benefits", label: "My Benefits", icon: Gift },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help & Support", icon: HelpCircle },
];

// Newsletter Subscriber navigation — a deliberately different, shorter list, per
// the same PDF page 6: no Member Offers/Collections/My Collection/Events/Stories/
// Care & Repair/My Benefits links at all for this tier, not even as disabled
// items. Also used for MONGOLIA until the client confirms Mongolia-specific
// access rules (see lib/access.ts).
const NEWSLETTER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/news", label: "News & Stories", icon: Newspaper },
  { href: "/orders", label: "My Orders", icon: Package },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/explore-membership", label: "Explore Membership", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/newsletter-settings", label: "Newsletter Settings", icon: Mail },
  { href: "/help", label: "Help & Support", icon: HelpCircle },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const member = useMember();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const navItems =
    member.membershipTier === "FOUNDING" || member.membershipTier === "ANNUAL"
      ? FULL_NAV_ITEMS
      : NEWSLETTER_NAV_ITEMS;

  return (
    <>
      {/* Mobile backdrop — clicking it closes the sidebar. Sidebar itself is fixed/
          overlaid below md; md and up it's a normal static column (see aside classes). */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between border-r border-cashmere-border bg-cashmere-sidebar px-4 py-6 transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-start justify-between px-2 pb-8">
            <div>
              <p className="text-lg font-semibold tracking-tight text-cashmere-text">
                Cashmere House
              </p>
              <p className="text-xs uppercase tracking-wide text-cashmere-text-muted">
                Cashmere Lovers Club
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-cashmere-text-muted md:hidden"
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
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
              {membershipTierLabel(
                member.membershipTier,
                member.isFoundingMember,
              )}
            </p>
            <p className="mt-1 text-cashmere-text-muted">
              Thank you for being part of something truly special.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
