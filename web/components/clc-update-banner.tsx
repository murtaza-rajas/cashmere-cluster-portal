"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchMyHomepageUpdate, type MemberHomepageUpdate } from "@/lib/api";

// "CLC Update" — the founder's launch-phase message on every member homepage
// (client design 2026-10-13). Content comes from Admin → CLC Update; nothing
// renders when no banner is active for this member's level.
export function ClcUpdateBanner({
  fetcher = fetchMyHomepageUpdate,
}: {
  fetcher?: () => Promise<MemberHomepageUpdate | null>;
}) {
  const [update, setUpdate] = useState<MemberHomepageUpdate | null>(null);

  useEffect(() => {
    fetcher()
      .then(setUpdate)
      .catch(() => setUpdate(null));
  }, [fetcher]);

  if (!update) return null;

  const date = update.displayDate
    ? new Date(update.displayDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cashmere-border bg-white sm:border-cashmere-accent/30 sm:bg-cashmere-bg">
      {update.imageUrl && (
        <div className="relative h-40 sm:absolute sm:inset-0 sm:h-auto">
          <Image src={update.imageUrl} alt="" fill className="object-cover object-right" />
        </div>
      )}
      {update.imageUrl && (
        <div className="absolute inset-0 hidden bg-gradient-to-r from-cashmere-bg via-cashmere-bg/80 to-transparent sm:block" />
      )}
      <div className="relative flex flex-col gap-2 p-6 sm:max-w-[60%] sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cashmere-accent-dark">{update.label}</p>
        <h2 className="font-serif text-2xl leading-tight tracking-tight text-cashmere-text sm:text-3xl">{update.title}</h2>
        <p className="text-sm text-cashmere-text-muted">{update.summary}</p>
        {date && <p className="text-xs text-cashmere-text-muted">{date}</p>}
        {update.storyId && (
          <Link
            href={`/news/${update.storyId}`}
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg bg-cashmere-accent-dark px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent"
          >
            Read the update <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </section>
  );
}
