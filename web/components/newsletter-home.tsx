"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Box,
  CalendarHeart,
  Gem,
  Gift,
  Heart,
  Leaf,
  Sprout,
  Users,
} from "lucide-react";
import { fetchMyStoryPreviews, type MemberStoryPreview } from "@/lib/api";
import { STORE_COLLECTIONS } from "@/lib/store-links";
import { LockBadge, useLockedDialog } from "@/components/locked-content";
import { ClcUpdateBanner } from "@/components/clc-update-banner";

// Newsletter (Level 1) homepage — client design draft 2026-10-12. Member-only
// content is shown with a lock (title, photo, teaser only) instead of being
// hidden; clicking it explains which membership opens it. Anything not built
// yet says "Coming soon" rather than linking nowhere.
export function NewsletterHome({ displayName }: { displayName: string }) {
  const locked = useLockedDialog();

  return (
    <div className="flex flex-col gap-8">
      {locked.dialog}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-cashmere-border bg-white sm:border-0 sm:bg-cashmere-sidebar">
        {/* Phones: photo on top, text below. sm+: text over the photo. */}
        <div className="relative h-44 sm:absolute sm:inset-0 sm:h-auto">
          <Image
            src="/images/newsletter-hero.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-[78%_30%] sm:object-[70%_30%]"
          />
        </div>
        <div className="absolute inset-0 hidden bg-gradient-to-r from-cashmere-bg/95 via-cashmere-bg/40 to-transparent sm:block" />
        <div className="relative flex flex-col justify-center gap-3 p-6 sm:aspect-[16/6] sm:p-10 lg:aspect-[16/5]">
          <h1 className="font-serif text-4xl tracking-tight text-cashmere-text sm:text-5xl">Welcome, {displayName}</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cashmere-accent-dark">
            Newsletter Subscriber
          </p>
          <p className="max-w-xs text-cashmere-text">Thank you for being part of the Cashmere House community.</p>
          <span
            className="mt-2 inline-flex w-fit cursor-default items-center gap-2 rounded-lg bg-cashmere-accent-dark/90 px-5 py-2.5 text-sm font-medium text-white"
            aria-disabled="true"
          >
            Explore our stories · Coming soon
          </span>
        </div>
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-black/45 to-transparent lg:block" />
        <p className="absolute right-8 bottom-8 hidden text-right font-serif text-xl leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)] lg:block">
          People.
          <br />
          Nature.
          <br />
          Craft.
          <br />A brighter tomorrow.
        </p>
      </section>

      {/* Shortcuts */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Shortcut href="/news" icon={BookOpen} title="Stories & News" subtitle="Be inspired" />
        <Shortcut href="/collections" icon={Box} title="Discover Collections" subtitle="Explore our pieces" />
        <Shortcut
          icon={Leaf}
          title="Care & Repair"
          subtitle="Keep it beautiful"
          locked
          onClick={() => locked.show("Care & Repair")}
        />
        <Shortcut icon={Users} title="Our Impact" subtitle="Coming soon" />
      </section>

      <ClcUpdateBanner />

      <LatestStories onLocked={(story) => locked.show(`"${story.title}"`, story.availableTo)} />

      {/* Collections */}
      <section className="flex flex-col gap-4">
        <SectionHeading title="Our Collections" href="/collections" linkLabel="View all collections" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STORE_COLLECTIONS.map((c) => (
            <CollectionCard key={c.title} {...c} />
          ))}
        </div>
      </section>

      {/* Care & Repair — member-only */}
      <section className="flex flex-col gap-4">
        <SectionHeading title="Care & Repair" href="/care-repair" linkLabel="See all guides" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <CareCard
            image="/images/care-guide.jpeg"
            eyebrow="Guides & tips"
            title="How to care for cashmere"
            text="Simple steps to keep your cashmere beautiful for years to come."
            cta="Read the guide"
            onClick={() => locked.show("Care & Repair")}
          />
          <CareCard
            image="/images/care-repairs.jpeg"
            eyebrow="Our services"
            title="Repairs for longer life"
            text="We help you give your cashmere a longer life."
            cta="Learn more"
            onClick={() => locked.show("Care & Repair")}
          />
        </div>
      </section>

      {/* Membership benefits */}
      <section className="grid grid-cols-1 gap-6 rounded-2xl border border-cashmere-border bg-white p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr_0.9fr] lg:items-center">
        <div>
          <h2 className="font-serif text-3xl tracking-tight text-cashmere-text">Discover the benefits of membership</h2>
          <p className="mt-3 text-sm text-cashmere-text-muted">
            Join the Cashmere Lovers Club and get closer to the people, places and stories behind the world&apos;s
            finest cashmere.
          </p>
          <Link
            href="/explore-membership"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cashmere-accent-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent"
          >
            Explore Membership <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="flex flex-col gap-3 text-sm text-cashmere-text">
          {[
            { icon: Gift, text: "Member-only offers" },
            { icon: Gem, text: "Early access to new collections" },
            { icon: CalendarHeart, text: "Exclusive events & invitations" },
            { icon: Sprout, text: "In-depth stories from Mongolia" },
            { icon: Heart, text: "Be part of a more sustainable future" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon size={20} strokeWidth={1.5} className="shrink-0 text-cashmere-accent" />
              {text}
            </li>
          ))}
        </ul>
        <div className="relative hidden aspect-[4/3] overflow-hidden rounded-xl lg:block">
          <Image src="/images/login-hero.jpeg" alt="" fill className="object-cover object-[50%_35%]" />
          <p className="absolute top-5 right-5 text-right font-serif text-lg italic leading-snug text-cashmere-navy">
            More than cashmere.
            <br />A community.
          </p>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-serif text-2xl tracking-tight text-cashmere-text sm:text-3xl">{title}</h2>
      <Link href={href} className="flex shrink-0 items-center gap-1 text-sm text-cashmere-accent-dark hover:underline">
        {linkLabel} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function Shortcut({
  href,
  icon: Icon,
  title,
  subtitle,
  locked,
  onClick,
}: {
  href?: string;
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  locked?: boolean;
  onClick?: () => void;
}) {
  // Stacked on phones (icon above text) so two tiles fit side by side.
  const body = (
    <>
      <Icon size={26} strokeWidth={1.25} className="shrink-0 text-cashmere-accent-dark" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-cashmere-text">{title}</span>
        <span className="block text-xs text-cashmere-text-muted">{subtitle}</span>
      </span>
      {locked ? (
        <LockBadge className="absolute top-3 right-3 shrink-0 sm:static" />
      ) : href ? (
        <ArrowRight size={16} className="absolute top-4 right-4 shrink-0 text-cashmere-text-muted sm:static" />
      ) : null}
    </>
  );
  const className =
    "relative flex flex-col items-start gap-2 rounded-xl border border-cashmere-border bg-white p-4 text-left transition-colors sm:flex-row sm:items-center sm:gap-3";
  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-cashmere-accent`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} hover:border-cashmere-accent`}>
        {body}
      </button>
    );
  }
  return <div className={`${className} opacity-70`}>{body}</div>;
}

function LatestStories({ onLocked }: { onLocked: (story: MemberStoryPreview) => void }) {
  const [stories, setStories] = useState<MemberStoryPreview[] | null>(null);

  useEffect(() => {
    fetchMyStoryPreviews()
      .then((all) => {
        // Featured stories first, then newest — the homepage shows three.
        const ordered = [...all.filter((s) => s.featured), ...all.filter((s) => !s.featured)];
        setStories(ordered.slice(0, 3));
      })
      .catch(() => setStories([]));
  }, []);

  if (stories === null) return null;

  const [lead, ...rest] = stories;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Latest from Cashmere House" href="/news" linkLabel="See all stories" />
      {!lead ? (
        <p className="rounded-2xl border border-cashmere-border bg-white p-8 text-center text-cashmere-text-muted">
          Stories coming soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
          <LeadStory story={lead} onLocked={onLocked} />
          <div className="flex flex-col gap-3">
            {rest.map((s) => (
              <SmallStory key={s.id} story={s} onLocked={onLocked} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StoryLink({
  story,
  onLocked,
  className,
  children,
}: {
  story: MemberStoryPreview;
  onLocked: (story: MemberStoryPreview) => void;
  className: string;
  children: React.ReactNode;
}) {
  if (story.locked) {
    return (
      <button type="button" onClick={() => onLocked(story)} className={`${className} text-left`}>
        {children}
      </button>
    );
  }
  return (
    <Link href={`/news/${story.id}`} className={className}>
      {children}
    </Link>
  );
}

function LeadStory({ story, onLocked }: { story: MemberStoryPreview; onLocked: (s: MemberStoryPreview) => void }) {
  return (
    <StoryLink
      story={story}
      onLocked={onLocked}
      className="group relative flex min-h-[20rem] flex-col justify-end overflow-hidden rounded-2xl bg-cashmere-navy p-6 sm:min-h-[24rem]"
    >
      {story.heroImageUrl && (
        <Image src={story.heroImageUrl} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      {story.locked && <LockBadge className="absolute top-4 right-4" />}
      <div className="relative max-w-md text-white">
        <p className="text-xs text-white/80">{formatDate(story.createdAt)}</p>
        <h3 className="mt-1 font-serif text-3xl leading-tight">{story.title}</h3>
        {story.excerpt && <p className="mt-2 line-clamp-3 text-sm text-white/85">{story.excerpt}</p>}
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-cashmere-text">
          Read the full story <ArrowRight size={14} />
        </span>
      </div>
    </StoryLink>
  );
}

function SmallStory({ story, onLocked }: { story: MemberStoryPreview; onLocked: (s: MemberStoryPreview) => void }) {
  return (
    <StoryLink
      story={story}
      onLocked={onLocked}
      className="relative flex flex-1 overflow-hidden rounded-2xl border border-cashmere-border bg-white transition-colors hover:border-cashmere-accent"
    >
      <div className="relative w-2/5 shrink-0 bg-cashmere-sidebar">
        {story.heroImageUrl && <Image src={story.heroImageUrl} alt="" fill className="object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <p className="text-xs text-cashmere-text-muted">{formatDate(story.createdAt)}</p>
        <h3 className="font-serif text-lg leading-snug text-cashmere-text">{story.title}</h3>
        {story.excerpt && <p className="line-clamp-3 text-sm text-cashmere-text-muted">{story.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm text-cashmere-accent-dark">
          Read more <ArrowRight size={14} />
        </span>
      </div>
      {story.locked && <LockBadge className="absolute top-3 right-3" />}
    </StoryLink>
  );
}

function CollectionCard({ title, image, href }: { title: string; image: string; href: string | null }) {
  const body = (
    <>
      <div className="relative aspect-[4/3] bg-cashmere-sidebar">
        <Image src={image} alt="" fill className="object-cover" />
      </div>
      <div className="p-4">
        <p className="font-serif text-lg text-cashmere-text">{title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-cashmere-accent-dark">
          {href ? (
            <>
              Explore <ArrowRight size={12} />
            </>
          ) : (
            "Coming soon"
          )}
        </p>
      </div>
    </>
  );
  const className = "overflow-hidden rounded-2xl border border-cashmere-border bg-white";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} transition-colors hover:border-cashmere-accent`}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function CareCard({
  image,
  eyebrow,
  title,
  text,
  cta,
  onClick,
}: {
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex overflow-hidden rounded-2xl border border-cashmere-border bg-white text-left transition-colors hover:border-cashmere-accent"
    >
      <div className="relative w-2/5 shrink-0 bg-cashmere-sidebar">
        <Image src={image} alt="" fill className="object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cashmere-accent-dark">{eyebrow}</p>
        <h3 className="font-serif text-xl text-cashmere-text">{title}</h3>
        <p className="text-sm text-cashmere-text-muted">{text}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm text-cashmere-accent-dark">
          {cta} <ArrowRight size={14} />
        </span>
      </div>
      <LockBadge className="absolute top-3 right-3" />
    </button>
  );
}
