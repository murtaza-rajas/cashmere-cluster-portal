"use client";

import { Bell, Menu } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { membershipTierLabel } from "@/lib/api";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const member = useMember();
  const displayName = member.firstName ?? member.email;
  const initial = (member.firstName ?? member.email).trim().charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-cashmere-border bg-cashmere-bg px-4 py-3 sm:justify-end sm:gap-6 sm:px-8">
      <button
        onClick={onMenuClick}
        className="text-cashmere-text-muted md:hidden"
        aria-label="Open menu"
      >
        <Menu size={22} strokeWidth={1.75} />
      </button>
      <div className="flex items-center gap-4 sm:gap-6">
        <button
          className="relative text-cashmere-text-muted"
          aria-label="Notifications"
        >
          <Bell size={20} strokeWidth={1.75} />
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cashmere-accent/15 font-serif text-base text-cashmere-accent-dark">
            {initial}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm text-cashmere-text">Welcome, {displayName}</span>
            <span className="block text-xs text-cashmere-text-muted">
              {membershipTierLabel(member.membershipTier, member.isFoundingMember, member.region)}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
