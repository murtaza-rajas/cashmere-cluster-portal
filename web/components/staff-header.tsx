"use client";

import { Bell, Menu, User } from "lucide-react";
import { useStaff } from "@/contexts/staff-context";

export default function StaffHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const staff = useStaff();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-cashmere-border bg-cashmere-bg px-4 py-4 sm:justify-end sm:gap-6 sm:px-8">
      <button onClick={onMenuClick} className="text-cashmere-text-muted md:hidden" aria-label="Open menu">
        <Menu size={22} strokeWidth={1.75} />
      </button>
      <div className="flex items-center gap-4 sm:gap-6">
        <button className="relative text-cashmere-text-muted" aria-label="Notifications">
          <Bell size={20} strokeWidth={1.75} />
        </button>
        <div className="flex items-center gap-2 text-sm text-cashmere-text">
          <User size={18} strokeWidth={1.75} />
          <span className="hidden sm:inline">{staff.name}</span>
        </div>
      </div>
    </header>
  );
}
