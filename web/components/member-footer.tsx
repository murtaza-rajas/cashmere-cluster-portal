import Link from "next/link";
import { SOCIAL_LINKS } from "@/lib/store-links";

// lucide-react no longer ships brand icons, so the two logos are inline SVG.
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

export default function MemberFooter() {
  return (
    <footer className="flex flex-col gap-4 border-t border-cashmere-border px-4 py-6 pb-24 text-xs text-cashmere-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 md:pb-6">
      <div>
        <p className="font-semibold uppercase tracking-[0.15em] text-cashmere-text">Cashmere House</p>
        <p className="mt-1">© {new Date().getFullYear()} Cashmere House Limited. All rights reserved.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/privacy-policy" className="hover:text-cashmere-text">Privacy Policy</Link>
        <Link href="/cookie-policy" className="hover:text-cashmere-text">Cookie Policy</Link>
        <Link href="/help" className="hover:text-cashmere-text">Contact Us</Link>
        <span className="flex items-center gap-4 text-cashmere-text">
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-cashmere-accent-dark">
            <InstagramIcon />
          </a>
          <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-cashmere-accent-dark">
            <FacebookIcon />
          </a>
        </span>
      </div>
    </footer>
  );
}
