import Image from "next/image";
import { Award, Gem, Gift, Heart, Leaf, Lock, MapPinned } from "lucide-react";
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
    // Explicit bg (not left to fall through to globals.css's body background)
    // — that background switches to near-black under prefers-color-scheme:
    // dark, which showed through anywhere this page's own content doesn't
    // fully cover the viewport (e.g. a viewport taller than the content).
    // This is a fixed cream+navy brand page, not meant to follow OS theme,
    // so it needs its own background regardless of the visitor's OS setting.
    <div className="flex min-h-screen flex-col items-center bg-cashmere-navy-dark">
      {/* Photo is confined to this wrapper (sized by its own in-flow children,
          not the whole page) instead of covering the entire min-h-screen
          container. Letting it span the full page made the photo's own
          bottom edge reappear below the solid footer band further down,
          producing a duplicated/redundant curve that isn't in the mockup —
          the mockup has exactly one clean navy transition, made by the
          footer band alone. No horizontal/top padding here — the photo must
          be edge-to-edge like the mockup; padding lives on the inner content
          wrapper below instead, so text doesn't touch the viewport edges but
          the photo still does. */}
      <div className="relative flex w-full flex-col items-center pt-16 pb-24">
        <Image src="/images/login-hero.jpeg" alt="" fill priority className="object-cover object-top" />


        {/* All text content shares this padded wrapper, so it keeps clear of
            the viewport edges while the photo itself (sibling, above) stays
            full-bleed. */}
        <div className="relative flex w-full flex-col items-center px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex font-serif text-6xl leading-none text-cashmere-navy">
              <span className="-mr-2">C</span>
              <span className="mt-3 -ml-2">L</span>
            </div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cashmere-navy">CASHMERE LOVERS&rsquo; CLUB</p>
            <HeartDivider className="mt-1 w-48" />
          </div>

          <div className="mt-10 w-full max-w-md rounded-3xl bg-cashmere-bg p-8 text-center shadow-2xl sm:p-10">
            <h1 className="font-serif text-3xl leading-tight text-cashmere-navy">
              Welcome to
              <br />
              Cashmere Lovers&rsquo; Club
            </h1>
            <HeartDivider className="mx-auto mt-4 w-20" />
            <p className="mt-4 text-sm text-cashmere-text-muted">
              Your exclusive community for ethical luxury, rooted in{" "}
              <strong className="text-cashmere-text">Mongolia</strong>. Crafted for a{" "}
              <strong className="text-cashmere-text">better future</strong>.
            </p>

            <div className="mt-6">
              <SessionStatus />
            </div>

            {/* Line runs edge-to-edge with the label sitting on top of it (matches
                the mockup's divider-with-centred-label), not a plain border
                above the row. */}
            <div className="relative mt-8 flex items-center justify-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-cashmere-border" />
              <span className="relative flex items-center gap-2 bg-cashmere-bg px-4 text-xs font-semibold uppercase tracking-wide text-cashmere-navy">
                <Lock size={14} strokeWidth={1.75} />
                Secure &amp; Private
              </span>
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
        </div>
      </div>

      {/* Solid (not a tint over the photo) — matches the mockup's own navy
          curve at the bottom of image1.jpeg, but built separately since this
          page's real content height varies and can't rely on a single fixed
          photo's baked-in shape landing in the right place at every viewport
          size the way a static mockup export can. */}
      <div className="relative w-full">
        {/* An SVG dome, not a CSS border-radius corner — a border-radius box
            only fills inside its own curve, leaving its "cut" corners fully
            transparent, so the photo behind showed through there. At some
            widths that gap happened to land on a bright sunlit ridge in the
            photo, reading as a stray gold seam; masking it with a gradient
            either washed out the curve's own visibility or left a visible
            rectangular seam of its own. An SVG path is a single solid fill
            with no transparent gap to begin with. preserveAspectRatio="none"
            with a fixed pixel height (not a % of width) also keeps the same
            dome depth at every viewport width, instead of the border-radius
            version going nearly flat and invisible on wide desktop screens.
            Taller from md: up so the solid dome itself physically covers that
            bright ridge line instead of trying to mask it with a gradient —
            a semi-transparent fade over the photo never fully hid a
            highlight that bright without also washing out the dome's own
            visibility against the photo above it. Stays at the original,
            shorter height below md: — a fixed tall height at every width
            looked fine on the wider crops where the highlight actually sits,
            but on a narrow phone viewport the same height reads as an
            exaggerated circular bite instead of a gentle wide dome. */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          aria-hidden
          className="relative -mt-16 block h-16 w-full text-cashmere-navy-dark md:-mt-40 md:h-40"
        >
          <path d="M0,100 C480,0 960,0 1440,100 Z" fill="currentColor" />
        </svg>

        {/* Plain rectangle, no radius — runs the full viewport width so there's
            no repeat of the earlier bug where a narrower centred band left the
            page's own background exposed either side of it below the photo. */}
        <div className="w-full bg-cashmere-navy-dark px-6 pt-8 pb-10">
          {/* Plain white text, no pill — the mockup shows it as bare text
              directly on the navy curve, and this band is always solid navy,
              so it's reliably legible without needing a background chip the
              way it did sitting on the photo. */}
          <p className="mx-auto max-w-3xl text-center text-sm text-white">
            Not a member yet?{" "}
            <a href="https://cashmerehouse.com" className="font-medium text-cashmere-accent hover:underline">
              Discover more about the Club →
            </a>
          </p>

          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
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
