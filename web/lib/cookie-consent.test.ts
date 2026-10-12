import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_COOKIE,
  CONSENT_VERSION,
  hasConsent,
  parseConsent,
  readConsent,
  saveConsent,
} from "./cookie-consent";

// Minimal browser stand-in: a cookie jar that behaves like document.cookie
// (writes set one cookie, reads return all as "a=b; c=d").
function installBrowser(protocol = "https:") {
  const jar = new Map<string, string>();
  const written: string[] = [];
  const document = {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      written.push(value);
      const [pair] = value.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    },
  };
  const window = Object.assign(new EventTarget(), { location: { protocol } });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  return { jar, written, window };
}

describe("cookie consent", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("has no consent until a choice is saved", () => {
    installBrowser();
    expect(readConsent()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
  });

  it("saves a choice by purpose, for a year, Secure on https, and announces it", () => {
    const { written, window } = installBrowser();
    const heard: unknown[] = [];
    window.addEventListener(CONSENT_CHANGED_EVENT, (e) => heard.push((e as CustomEvent).detail));

    saveConsent({ preferences: true, analytics: false, marketing: false });

    expect(hasConsent("preferences")).toBe(true);
    expect(hasConsent("analytics")).toBe(false);
    expect(hasConsent("marketing")).toBe(false);
    expect(written[0]).toContain(`${CONSENT_COOKIE}=`);
    expect(written[0]).toContain("Max-Age=31536000");
    expect(written[0]).toContain("SameSite=Lax");
    expect(written[0]).toContain("Secure");
    expect(heard).toHaveLength(1);
  });

  it("can be withdrawn: rejecting after accepting turns everything optional off", () => {
    installBrowser();
    saveConsent({ preferences: true, analytics: true, marketing: true });
    saveConsent({ preferences: false, analytics: false, marketing: false });
    expect(readConsent()).toMatchObject({ preferences: false, analytics: false, marketing: false });
  });

  it("ignores a choice saved under an older version, so visitors are asked again", () => {
    const stale = encodeURIComponent(JSON.stringify({ version: CONSENT_VERSION - 1, analytics: true }));
    expect(parseConsent(stale)).toBeNull();
    expect(parseConsent("not-json")).toBeNull();
  });

  it("omits Secure on plain http (local development)", () => {
    const { written } = installBrowser("http:");
    saveConsent({ preferences: false, analytics: false, marketing: false });
    expect(written[0]).not.toContain("Secure");
  });
});
