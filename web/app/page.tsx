import Image from "next/image";
import { Award, Gem, Gift, Heart, Leaf, MapPinned } from "lucide-react";
import SessionStatus from "./session-status";

// Matches the client's login-ui.jpeg wireframe exactly: the real photo
// (public/images/login-hero.jpeg = the client's own image1.jpeg) is shown
// as-is, full colour, no dark overlay on top of it — the mockup itself has
// none. Text over the photo is navy (matching the mockup), not white — white
// was a leftover from the earlier CSS-gradient-only version and was never
// correct once a real (light-sky) photo replaced it. Only "Not a member yet"
// and the footer band stay white, since they sit low enough to fall on the
// photo's own darker lower portion / the solid navy footer below it.
export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 py-16">
      <Image src="/images/login-hero.jpeg" alt="" fill priority className="object-cover object-top" />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="flex font-serif text-6xl leading-none text-cashmere-navy">
          <span className="-mr-2">C</span>
          <span className="mt-3 -ml-2">L</span>
        </div>
        <p className="text-sm font-semibold tracking-[0.3em] text-cashmere-navy">CASHMERE LOVERS&rsquo; CLUB</p>
        <HeartDivider className="mt-1 w-48" />
      </div>

      <div className="relative mt-10 w-full max-w-md rounded-3xl bg-cashmere-bg p-8 text-center shadow-2xl sm:p-10">
        <h1 className="font-serif text-3xl leading-tight text-cashmere-navy">
          Welcome to
          <br />
          Cashmere Lovers&rsquo; Club
        </h1>
        <HeartDivider className="mx-auto mt-4 w-20" />
        <p className="mt-4 text-sm text-cashmere-text-muted">
          Your exclusive community for ethical luxury, rooted in <strong className="text-cashmere-text">Mongolia</strong>.
          Crafted for a <strong className="text-cashmere-text">better future</strong>.
        </p>

        <div className="mt-6">
          <SessionStatus />
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 border-t border-cashmere-border pt-6 text-xs font-semibold uppercase tracking-wide text-cashmere-navy">
          <Award size={14} strokeWidth={1.75} />
          Secure &amp; Private
        </div>
        <p className="mt-2 text-xs text-cashmere-text-muted">
          Your data is safe with us and used only to enhance your experience.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-cashmere-border pt-6 text-xs">
          <TrustItem
            icon={Gift}
            title="Member Benefits"
            description="Exclusive offers, early access and special privileges."
          />
          <TrustItem
            icon={Award}
            title="Exclusive Access"
            description="For members only — stories, insights and inspiration."
          />
          <TrustItem icon={Leaf} title="Ethical by Nature" description="Respect for animals, people and the planet." />
        </div>
      </div>

      {/* Navy, not white — this row lands on a light/varied part of the photo
          (checked live: it does not reliably land on a dark area the way it
          does in the static mockup export), so white text isn't legible here. */}
      <div className="relative mt-8 rounded-full bg-cashmere-bg/90 px-6 py-2 text-center text-sm text-cashmere-text shadow-sm">
        Not a member yet?{" "}
        <a
          href="https://cashmerehouse.com"
          className="font-medium text-cashmere-accent hover:underline"
        >
          Discover more about the Club →
        </a>
      </div>

      {/* Solid (not a tint over the photo) — matches the mockup's own navy
          curve at the bottom of image1.jpeg, but built separately in CSS
          since this page's real content height varies and can't rely on a
          single fixed photo's baked-in shape landing in the right place at
          every viewport size the way a static mockup export can. */}
      <div className="relative mt-12 w-full max-w-3xl rounded-t-[3rem] bg-cashmere-navy-dark px-6 py-10">
        <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
          <FooterItem
            icon={MapPinned}
            title="Rooted in Mongolia"
            description="Supporting local herders and communities."
          />
          <FooterItem icon={Gem} title="Timeless Quality" description="Crafted to last for generations." />
          <FooterItem icon={Heart} title="Made with Care" description="From the finest Mongolian cashmere." />
        </div>
      </div>
    </div>
  );
}

function HeartDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="h-px flex-1 bg-cashmere-accent/50" />
      <Heart size={12} strokeWidth={1.75} className="text-cashmere-accent" />
      <span className="h-px flex-1 bg-cashmere-accent/50" />
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Gift;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Icon size={20} strokeWidth={1.5} className="text-cashmere-accent" />
      <p className="font-semibold text-cashmere-navy">{title}</p>
      <p className="text-cashmere-text-muted">{description}</p>
    </div>
  );
}

function FooterItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MapPinned;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Icon size={20} strokeWidth={1.5} className="text-cashmere-accent" />
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-white/70">{description}</p>
    </div>
  );
}
