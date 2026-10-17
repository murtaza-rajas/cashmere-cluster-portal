"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Headphones,
  Palette,
  Lock,
} from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { fetchMySiteImages } from "@/lib/api";
import { getAccessLevel } from "@/lib/access";

const DEFAULT_SIDEBAR_HELP_PHOTO = "/images/sidebar-help.jpeg";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  // Shown with a lock: the page opens, but its content is member-only.
  locked?: boolean;
}

// Founding/Annual/6-Month navigation — per cashmere-lovers-club-access-
// administration-model PDF, page 6 ("Navigation menus"), regrouped per the
// client's own request (2026-10-07) into 5 visual groups with dividers
// between them (group headings deliberately omitted — he said they "do not
// necessarily need to appear"). Grouped as a nested array, not a flat list
// with inserted dividers, so the groups stay the source of truth for both
// the ordering and where the divider lines go.
const FULL_NAV_GROUPS: NavItem[][] = [
  [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  [
    { href: "/benefits", label: "My Benefits", icon: Gift },
    { href: "/member-offers", label: "Member Offers", icon: Tag, badge: "NEW" },
    { href: "/exclusive-collections", label: "Exclusive Collections", icon: ShoppingBag },
  ],
  [
    { href: "/news", label: "Stories & Knowledge", icon: Newspaper },
    // Founding-only in practice (filtered out below for Annual/6-Month, per
    // lib/access.ts's designLab area) — those tiers reach a preview of this
    // same page via a dashboard teaser card instead of a persistent nav
    // item, confirmed directly from the client's own tier-homepage mockups.
    { href: "/design-lab", label: "Design Lab", icon: Palette, badge: "NEW" },
    { href: "/invitations", label: "Invitations & Events", icon: CalendarHeart },
  ],
  [
    { href: "/wishlist", label: "Wishlist", icon: Heart },
    { href: "/orders", label: "My Orders", icon: Package },
    { href: "/collection", label: "My Collection", icon: Shirt },
    { href: "/care-repair", label: "Care & Repair", icon: Wrench },
    // For upgrading — hidden for Founding, the top level (filtered below).
    { href: "/explore-membership", label: "Explore Membership", icon: Sparkles },
  ],
  [
    { href: "/profile", label: "Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help & Support", icon: HelpCircle },
  ],
];

// Newsletter Subscriber navigation — client's Level 1 design (2026-10-12),
// replacing the PDF's original shorter list: Stories & News and Care & Repair
// are now shown (Care & Repair with a lock), plus Collections. Also used for
// MONGOLIA until Mongolia-specific rules are confirmed (see lib/access.ts).
const NEWSLETTER_NAV_GROUPS: NavItem[][] = [
  [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/news", label: "Stories & News", icon: Newspaper },
    { href: "/collections", label: "Collections", icon: ShoppingBag },
    { href: "/orders", label: "My Orders", icon: Package },
    { href: "/wishlist", label: "Wishlist", icon: Heart },
    { href: "/care-repair", label: "Care & Repair", icon: Wrench, locked: true },
    { href: "/explore-membership", label: "Explore Membership", icon: Sparkles },
  ],
  [
    { href: "/profile", label: "Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help & Support", icon: HelpCircle },
  ],
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
  // SIX_MONTH added here 2026-10-07 — was falling through to the short
  // Newsletter nav (a real bug: access.ts already treats SIX_MONTH exactly
  // like ANNUAL, this check just hadn't caught up with it).
  const hasFullNav =
    member.membershipTier === "FOUNDING" ||
    member.membershipTier === "ANNUAL" ||
    member.membershipTier === "SIX_MONTH";
  const navGroups: NavItem[][] = hasFullNav
    ? FULL_NAV_GROUPS.map((group) =>
        group.filter(
          (item) =>
            (item.href !== "/design-lab" || getAccessLevel(member.membershipTier, "designLab") === "full") &&
            (item.href !== "/explore-membership" || !member.isFoundingMember),
        ),
      )
    : NEWSLETTER_NAV_GROUPS;

  const [helpPhotoSrc, setHelpPhotoSrc] = useState(DEFAULT_SIDEBAR_HELP_PHOTO);
  useEffect(() => {
    // Staff-uploaded, tier-specific photo (Milestone 5) — falls back to the
    // bundled default above for any tier staff haven't set one for yet.
    fetchMySiteImages()
      .then((images) => {
        if (images.SIDEBAR_HELP) setHelpPhotoSrc(images.SIDEBAR_HELP);
      })
      .catch(() => undefined);
  }, []);

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-hidden border-r border-cashmere-border bg-cashmere-sidebar transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="flex items-start justify-between px-2 pb-8">
            <Link href="/dashboard" onClick={onClose} aria-label="Cashmere Lovers' Club — home">
              <Image
                src="/images/clc-logo.png"
                alt="Cashmere Lovers' Club"
                width={474}
                height={240}
                className="h-auto w-40"
                priority
              />
            </Link>
            <button
              onClick={onClose}
              className="text-cashmere-text-muted md:hidden"
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>

          <nav className="flex flex-col">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex} className={`flex flex-col gap-1 ${groupIndex > 0 ? "mt-3 border-t border-cashmere-border pt-3" : ""}`}>
                {group.map(({ href, label, icon: Icon, badge, locked }) => {
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
                      {locked && (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-cashmere-accent-dark"
                          aria-label="Members only"
                        >
                          <Lock size={12} strokeWidth={2} />
                        </span>
                      )}
                      {badge && (
                        <span className="rounded-full bg-cashmere-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}

            <a
              href={`${apiUrl}/auth/logout`}
              className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-cashmere-text-muted hover:bg-cashmere-border/60"
            >
              <LogOut size={18} strokeWidth={1.75} />
              Log out
            </a>
          </nav>
        </div>

        {/* Matches founding-member-dashboard.jpeg's sidebar footer — a "Need
            Help?" card, then a full-bleed photo filling the rest of the
            sidebar down to the bottom edge. Previously this was a different,
            invented "thank you" card shown only to Founding members; the
            mockup's actual sidebar footer isn't tier-specific and has no such
            card at all (Founding status is shown in the dark stat card in the
            main content instead), so this replaces it rather than sitting
            alongside it. */}
        {hasFullNav ? (
          <>
          <div className="shrink-0 px-4 pb-4">
            <div className="rounded-lg border border-cashmere-border bg-white/60 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text">Need Help?</p>
              <p className="mt-1 text-cashmere-text-muted">We are here for you</p>
              <Link
                href="/help"
                onClick={onClose}
                className="mt-3 flex items-center justify-center gap-2 rounded-full border border-cashmere-border bg-white px-4 py-2 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
              >
                <Headphones size={16} strokeWidth={1.75} />
                Contact Support
              </Link>
            </div>
          </div>
          <div className="relative h-48 shrink-0">
            <Image
              src={helpPhotoSrc}
              alt=""
              fill
              className="object-cover"
              // Only the bundled default needs this specific crop focal point
              // (isolates the goat herd from image19.jpeg's much wider scene,
              // away from the herder/yurt on the left) — a staff-uploaded
              // override could be framed completely differently, so it gets a
              // plain centred crop instead of guessing a focal point for it.
              style={helpPhotoSrc === DEFAULT_SIDEBAR_HELP_PHOTO ? { objectPosition: "72% 55%" } : undefined}
            />
          </div>
          </>
        ) : (
          <div className="shrink-0 px-4 pb-6">
            <div className="overflow-hidden rounded-xl border border-cashmere-border bg-white/70">
              <p className="p-4 font-serif text-lg leading-snug text-cashmere-text">
                &ldquo;A more sustainable and beautiful future. Together.&rdquo;
              </p>
              <div className="relative h-32">
                <Image src={DEFAULT_SIDEBAR_HELP_PHOTO} alt="" fill className="object-cover" style={{ objectPosition: "72% 55%" }} />
              </div>
            </div>
            <p className="mt-4 text-center font-serif text-lg italic text-cashmere-accent-dark">
              Good Cashmere. Brighter Futures.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
