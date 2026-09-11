"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Factory, Images, Vote, Gift, Globe2, CalendarHeart, UserCog } from "lucide-react";
import { fetchMembers, fetchMongoliaStoryCatalog, fetchMongoliaProducerCatalog } from "@/lib/staff-api";

interface ModuleCard {
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
}

const MODULES: ModuleCard[] = [
  { href: "/staff/mongolia/stories", label: "Stories & News", description: "Create and manage stories from Mongolia.", icon: BookOpen },
  { href: "/staff/mongolia/producers", label: "Producers", description: "Manage producer profiles.", icon: Factory },
  { href: "/staff/mongolia/photos", label: "Photo Archive", description: "Member-submitted photos (coming soon).", icon: Images },
  { href: "/staff/mongolia/voting", label: "Your Voice / Voting", description: "See how members are voting on producers.", icon: Vote },
  { href: "/staff/mongolia/offers", label: "Current Offers", description: "Manage offers for Mongolia members.", icon: Gift },
  { href: "/staff/mongolia/world", label: "Mongolia and the World", description: "Diaspora and global-community stories.", icon: Globe2 },
  { href: "/staff/mongolia/events", label: "Events", description: "Create and manage events in Mongolia.", icon: CalendarHeart },
  { href: "/staff/mongolia/membership", label: "Membership Access", description: "Look up Mongolia members.", icon: UserCog },
];

// Mongolia Dashboard — client's mockup (mongolia-admin-interface.png,
// 2026-09-11) shows a real landing page, not just a bare module list. Stat
// cards use real, already-available data (member/story/producer/vote
// counts) rather than inventing new report endpoints just to match the
// mockup's exact figures — the client's own note says the design is "only
// a concept illustration... no need to copy the exact visual design or
// dashboard figures."
export default function MongoliaDashboardPage() {
  const [memberCounts, setMemberCounts] = useState<{ founding: number; newsletter: number } | null>(null);
  const [storyCount, setStoryCount] = useState<number | null>(null);
  const [producerStats, setProducerStats] = useState<{ count: number; votes: number } | null>(null);

  useEffect(() => {
    fetchMembers()
      .then((members) => {
        const mongolia = members.filter((m) => m.region === "MONGOLIA");
        setMemberCounts({
          founding: mongolia.filter((m) => m.membershipTier === "MONGOLIA").length,
          newsletter: mongolia.filter((m) => m.membershipTier === "NEWSLETTER").length,
        });
      })
      .catch(() => setMemberCounts(null));

    fetchMongoliaStoryCatalog()
      .then((rows) => setStoryCount(rows.length))
      .catch(() => setStoryCount(null));

    fetchMongoliaProducerCatalog()
      .then((rows) => setProducerStats({ count: rows.length, votes: rows.reduce((sum, p) => sum + p.voteCount, 0) }))
      .catch(() => setProducerStats(null));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-cashmere-navy to-cashmere-navy-dark px-6 py-10 text-white sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Mongolia Admin</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Stories. People. Opportunities.</h1>
        <p className="mt-2 max-w-lg text-white/80">Manage Mongolia-specific content, members and community for Cashmere Lovers Club.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-cashmere-border bg-white p-4">
          <Users size={18} strokeWidth={1.75} className="text-cashmere-accent-dark" />
          <p className="mt-2 text-2xl font-semibold text-cashmere-text">
            {memberCounts ? memberCounts.founding + memberCounts.newsletter : "—"}
          </p>
          <p className="text-xs text-cashmere-text-muted">
            Mongolia members {memberCounts && `(${memberCounts.founding} Founding, ${memberCounts.newsletter} Newsletter)`}
          </p>
        </div>
        <div className="rounded-2xl border border-cashmere-border bg-white p-4">
          <BookOpen size={18} strokeWidth={1.75} className="text-cashmere-accent-dark" />
          <p className="mt-2 text-2xl font-semibold text-cashmere-text">{storyCount ?? "—"}</p>
          <p className="text-xs text-cashmere-text-muted">Stories published</p>
        </div>
        <div className="rounded-2xl border border-cashmere-border bg-white p-4">
          <Factory size={18} strokeWidth={1.75} className="text-cashmere-accent-dark" />
          <p className="mt-2 text-2xl font-semibold text-cashmere-text">{producerStats?.count ?? "—"}</p>
          <p className="text-xs text-cashmere-text-muted">Producers</p>
        </div>
        <div className="rounded-2xl border border-cashmere-border bg-white p-4">
          <Vote size={18} strokeWidth={1.75} className="text-cashmere-accent-dark" />
          <p className="mt-2 text-2xl font-semibold text-cashmere-text">{producerStats?.votes ?? "—"}</p>
          <p className="text-xs text-cashmere-text-muted">Votes cast</p>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl tracking-tight text-cashmere-text">Mongolia Admin Modules</h2>
        <p className="mt-1 text-sm text-cashmere-text-muted">Quick access to all Mongolia-specific content and community features.</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="flex flex-col gap-2 rounded-2xl border border-cashmere-border bg-white p-5 transition-colors hover:border-cashmere-accent"
            >
              <mod.icon size={20} strokeWidth={1.75} className="text-cashmere-accent-dark" />
              <p className="font-medium text-cashmere-text">{mod.label}</p>
              <p className="text-sm text-cashmere-text-muted">{mod.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
