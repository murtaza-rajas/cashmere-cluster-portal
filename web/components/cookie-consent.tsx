"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  OPEN_SETTINGS_EVENT,
  openCookieSettings,
  parseConsent,
  readConsent,
  readConsentRaw,
  saveConsent,
  subscribeToConsent,
  type OptionalCategory,
} from "@/lib/cookie-consent";

const CATEGORIES: { key: OptionalCategory; title: string; description: string }[] = [
  {
    key: "preferences",
    title: "Preferences",
    description: "Remember choices such as language or display settings.",
  },
  {
    key: "analytics",
    title: "Analytics",
    description: "Help us understand how the portal is used so we can improve it.",
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "Measure campaigns and show more relevant advertising.",
  },
];

const NONE: Record<OptionalCategory, boolean> = { preferences: false, analytics: false, marketing: false };
const ALL: Record<OptionalCategory, boolean> = { preferences: true, analytics: true, marketing: true };

// Shown on every visitor-facing page until a choice is made; the staff admin
// is excluded. "Accept all" and "Reject all" are deliberately the same style —
// rejecting must be as easy as accepting (Cookie Policy).
export default function CookieConsent() {
  const pathname = usePathname();
  // null on the server and during hydration, so nothing renders until the
  // browser's own cookie is known — no banner flash for people who chose.
  const raw = useSyncExternalStore(subscribeToConsent, readConsentRaw, () => null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [choice, setChoice] = useState(NONE);

  const openSettings = useCallback(() => {
    const current = readConsent();
    setChoice(
      current
        ? { preferences: current.preferences, analytics: current.analytics, marketing: current.marketing }
        : NONE,
    );
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, [openSettings]);

  if (raw === null || pathname?.startsWith("/staff")) return null;

  const decide = (c: Record<OptionalCategory, boolean>) => {
    saveConsent(c);
    setSettingsOpen(false);
  };

  if (settingsOpen) {
    return (
      <SettingsDialog
        choice={choice}
        onChange={setChoice}
        onSave={() => decide(choice)}
        onAcceptAll={() => decide(ALL)}
        onRejectAll={() => decide(NONE)}
        onClose={() => setSettingsOpen(false)}
      />
    );
  }

  if (parseConsent(raw)) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-cashmere-border bg-cashmere-bg p-5 shadow-2xl sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex-1 text-sm text-cashmere-text-muted">
          <p className="font-serif text-lg text-cashmere-text">Cookies</p>
          <p className="mt-1">
            We use necessary cookies to keep you signed in and the portal secure. With your permission we&apos;d also
            like to use optional cookies for preferences, analytics and marketing. You can change your choice at any
            time.{" "}
            <Link href="/cookie-policy" className="text-cashmere-accent-dark underline">
              Cookie Policy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          <button type="button" onClick={() => decide(ALL)} className={PRIMARY}>
            Accept all
          </button>
          <button type="button" onClick={() => decide(NONE)} className={PRIMARY}>
            Reject all
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="py-1 text-sm text-cashmere-accent-dark underline-offset-2 hover:underline"
          >
            Choose cookies
          </button>
        </div>
      </div>
    </div>
  );
}

const PRIMARY =
  "rounded-full bg-cashmere-navy px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-navy-dark";

function SettingsDialog({
  choice,
  onChange,
  onSave,
  onAcceptAll,
  onRejectAll,
  onClose,
}: {
  choice: Record<OptionalCategory, boolean>;
  onChange: (c: Record<OptionalCategory, boolean>) => void;
  onSave: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-cashmere-bg p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="cookie-settings-title" className="font-serif text-2xl text-cashmere-text">
            Cookie settings
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-cashmere-text-muted hover:bg-cashmere-border/60"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p className="mt-2 text-sm text-cashmere-text-muted">
          Choose which optional cookies we may use. Your choice doesn&apos;t affect your newsletter subscription or
          membership.
        </p>

        <ul className="mt-5 flex flex-col divide-y divide-cashmere-border rounded-xl border border-cashmere-border bg-white">
          <li className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-cashmere-text">Strictly necessary</p>
              <p className="mt-0.5 text-xs text-cashmere-text-muted">
                Sign-in, security and remembering this choice. Always on.
              </p>
            </div>
            <Toggle checked disabled label="Strictly necessary" onChange={() => undefined} />
          </li>
          {CATEGORIES.map(({ key, title, description }) => (
            <li key={key} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium text-cashmere-text">{title}</p>
                <p className="mt-0.5 text-xs text-cashmere-text-muted">{description}</p>
              </div>
              <Toggle
                checked={choice[key]}
                label={title}
                onChange={(v) => onChange({ ...choice, [key]: v })}
              />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={onSave} className={`${PRIMARY} sm:flex-1`}>
            Save choices
          </button>
          <button
            type="button"
            onClick={onRejectAll}
            className="rounded-full border border-cashmere-border bg-white px-5 py-2.5 text-sm font-medium text-cashmere-text hover:border-cashmere-accent sm:flex-1"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="rounded-full border border-cashmere-border bg-white px-5 py-2.5 text-sm font-medium text-cashmere-text hover:border-cashmere-accent sm:flex-1"
          >
            Accept all
          </button>
        </div>
        <Link href="/cookie-policy" onClick={onClose} className="mt-4 text-center text-xs text-cashmere-accent-dark underline">
          Read our Cookie Policy
        </Link>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cashmere-accent disabled:opacity-60 ${
        checked ? "bg-cashmere-navy" : "bg-cashmere-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

// "Cookie settings" link for footers — reopens the settings so consent can be
// changed or withdrawn as easily as it was given.
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookie settings
    </button>
  );
}
