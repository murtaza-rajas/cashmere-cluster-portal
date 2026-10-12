"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import type { Member } from "@/lib/api";

type Tier = Member["membershipTier"];

const TIER_NAMES: Partial<Record<Tier, string>> = {
  SIX_MONTH: "6-Month",
  ANNUAL: "Annual",
  FOUNDING: "Founding",
};

// "Annual and Founding Members", "6-Month, Annual and Founding Members".
// Defaults to Annual + Founding — the levels the client names for locked
// content (6-Month has the same access as Annual but is Norway-only).
export function membersWhoCanAccess(tiers: Tier[] = ["ANNUAL", "FOUNDING"]): string {
  const names = (["SIX_MONTH", "ANNUAL", "FOUNDING"] as Tier[])
    .filter((t) => tiers.includes(t))
    .map((t) => TIER_NAMES[t]!);
  if (names.length === 0) return "members";
  if (names.length === 1) return `${names[0]} Members`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} Members`;
}

export function LockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-cashmere-accent-dark shadow-sm ${className}`}
      aria-label="Members only"
      title="Members only"
    >
      <Lock size={13} strokeWidth={2} />
    </span>
  );
}

// One dialog per page: call show("Care & Repair") from any locked card,
// shortcut or link, and render `dialog` once.
export function useLockedDialog() {
  const [state, setState] = useState<{ feature: string; tiers?: Tier[] } | null>(null);
  const show = useCallback((feature: string, tiers?: Tier[]) => setState({ feature, tiers }), []);
  const close = useCallback(() => setState(null), []);
  const dialog = state ? <LockedDialog feature={state.feature} tiers={state.tiers} onClose={close} /> : null;
  return { show, dialog };
}

function LockedDialog({ feature, tiers, onClose }: { feature: string; tiers?: Tier[]; onClose: () => void }) {
  const primaryRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-dialog-title"
        className="w-full max-w-sm rounded-2xl bg-cashmere-bg p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label="Close" className="-mt-2 -mr-2 rounded-full p-1.5 text-cashmere-text-muted hover:bg-cashmere-border/60">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cashmere-accent/15 text-cashmere-accent-dark">
          <Lock size={20} strokeWidth={1.75} />
        </span>
        <h2 id="locked-dialog-title" className="mt-4 font-serif text-2xl text-cashmere-text">
          Members only
        </h2>
        <p className="mt-2 text-sm text-cashmere-text-muted">
          {feature} is available to {membersWhoCanAccess(tiers)}.
        </p>
        <Link
          ref={primaryRef}
          href="/explore-membership"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-cashmere-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
        >
          Explore Membership
        </Link>
        <button type="button" onClick={onClose} className="mt-3 text-sm text-cashmere-text-muted hover:text-cashmere-text">
          Not now
        </button>
      </div>
    </div>
  );
}
