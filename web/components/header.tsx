"use client";

import { Bell, User } from "lucide-react";
import { useMember } from "@/contexts/member-context";

export default function Header() {
  const member = useMember();
  const displayName = member.firstName ?? member.email;

  return (
    <header className="flex items-center justify-end gap-6 border-b border-cashmere-border bg-cashmere-bg px-8 py-4">
      <button className="relative text-cashmere-text-muted" aria-label="Notifications">
        <Bell size={20} strokeWidth={1.75} />
      </button>
      <div className="flex items-center gap-2 text-sm text-cashmere-text">
        <User size={18} strokeWidth={1.75} />
        {displayName}
      </div>
    </header>
  );
}
