"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { getAccessLevel } from "@/lib/access";
import { STORE_COLLECTIONS } from "@/lib/store-links";
import { LockBadge, useLockedDialog } from "@/components/locked-content";

// Standard collections link out to the online store; Exclusive Collections
// are member-only (locked for Newsletter, client request 2026-10-12).
export default function CollectionsPage() {
  const member = useMember();
  const exclusiveLocked = getAccessLevel(member.membershipTier, "exclusiveCollections") !== "full";
  const locked = useLockedDialog();

  return (
    <div className="flex w-full flex-col gap-6">
      {locked.dialog}
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Our Collections</h1>
        <p className="mt-1 text-cashmere-text-muted">Explore our cashmere in the online store.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {STORE_COLLECTIONS.map(({ title, image, href }) => {
          const body = (
            <>
              <div className="relative aspect-[16/10] bg-cashmere-sidebar">
                <Image src={image} alt="" fill className="object-cover" />
              </div>
              <div className="flex items-center justify-between p-5">
                <p className="font-serif text-xl text-cashmere-text">{title}</p>
                {href ? (
                  <span className="flex items-center gap-1 text-sm text-cashmere-accent-dark">
                    Shop now <ExternalLink size={14} />
                  </span>
                ) : (
                  <span className="text-sm text-cashmere-text-muted">Coming soon</span>
                )}
              </div>
            </>
          );
          const className = "overflow-hidden rounded-2xl border border-cashmere-border bg-white";
          return href ? (
            <a key={title} href={href} target="_blank" rel="noopener noreferrer" className={`${className} transition-colors hover:border-cashmere-accent`}>
              {body}
            </a>
          ) : (
            <div key={title} className={className}>
              {body}
            </div>
          );
        })}
      </div>

      <ExclusiveCard locked={exclusiveLocked} onLocked={() => locked.show("Exclusive Collections")} />
    </div>
  );
}

function ExclusiveCard({ locked, onLocked }: { locked: boolean; onLocked: () => void }) {
  const body = (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cashmere-accent-dark">Members only</p>
        <p className="mt-1 font-serif text-2xl text-cashmere-text">Exclusive Collections</p>
        <p className="mt-1 text-sm text-cashmere-text-muted">Limited pieces made for Cashmere Lovers Club members.</p>
      </div>
      {locked ? <LockBadge className="h-9 w-9 shrink-0" /> : <ArrowRight size={20} className="shrink-0 text-cashmere-accent-dark" />}
    </>
  );
  const className =
    "flex items-center justify-between gap-4 rounded-2xl border border-cashmere-border bg-cashmere-sidebar/60 p-6 text-left transition-colors hover:border-cashmere-accent";
  return locked ? (
    <button type="button" onClick={onLocked} className={className}>
      {body}
    </button>
  ) : (
    <Link href="/exclusive-collections" className={className}>
      {body}
    </Link>
  );
}
