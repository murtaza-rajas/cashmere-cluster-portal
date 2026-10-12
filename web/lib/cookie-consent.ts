// Cookie consent (Cookie Policy: accept, reject or choose by purpose on first
// visit; change or withdraw later as easily). The choice is kept in a
// first-party cookie, which is itself strictly necessary — it is how the
// choice is remembered.
//
// Nothing optional is loaded today. Any future analytics/advertising script
// must check hasConsent() first and listen for CONSENT_CHANGED_EVENT, so it
// stays off until the visitor has accepted that category.

export type OptionalCategory = "preferences" | "analytics" | "marketing";

export interface CookieConsent {
  version: number;
  decidedAt: string;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

export const CONSENT_COOKIE = "clc_cookie_consent";
// Bump when the categories or their meaning change, so everyone is asked again.
export const CONSENT_VERSION = 1;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const CONSENT_CHANGED_EVENT = "clc:cookie-consent-changed";
export const OPEN_SETTINGS_EVENT = "clc:open-cookie-settings";

// Raw cookie value ("" when unset) — a stable string, suitable as a
// useSyncExternalStore snapshot.
export function readConsentRaw(): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1) ?? ""
  );
}

export function subscribeToConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
}

export function readConsent(): CookieConsent | null {
  return parseConsent(readConsentRaw());
}

export function parseConsent(raw: string): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CookieConsent;
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: Record<OptionalCategory, boolean>): CookieConsent {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    ...choice,
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
  return consent;
}

export function hasConsent(category: OptionalCategory): boolean {
  return readConsent()?.[category] === true;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
