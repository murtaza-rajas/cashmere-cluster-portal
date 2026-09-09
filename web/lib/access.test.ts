import { describe, it, expect } from "vitest";
import { getAccessLevel, AccessLevel, PortalArea } from "./access";

// Expected values transcribed independently from the client's spec PDF
// (cashmere-lovers-club-access-administration-model, page 5, "Customer portal
// access matrix"), NOT copied from access.ts's own implementation — the point is
// to catch a transcription error in the implementation, which a test that just
// re-asserts the same source data can't do.
// The 13 areas named in the PDF. designLab is deliberately NOT one of them —
// it postdates the PDF entirely (client email 2026-09-07/08) and, unlike
// every area here, Founding and Annual genuinely differ on it — see the
// separate describe block below rather than folding it into this constant.
type PdfArea = Exclude<PortalArea, "designLab">;

const EXPECTED_FOUNDING_AND_ANNUAL: Record<PdfArea, AccessLevel> = {
  dashboard: "full",
  memberOffers: "full",
  exclusiveCollections: "full",
  myOrders: "full",
  myCollection: "full",
  wishlist: "full",
  invitationsEvents: "full",
  storiesKnowledge: "full",
  careRepair: "full",
  myBenefits: "full",
  profile: "full",
  settings: "full",
  helpSupport: "full",
};

const EXPECTED_NEWSLETTER: Record<PdfArea, AccessLevel> = {
  dashboard: "preview", // "Simple home page"
  memberOffers: "none", // "No access"
  exclusiveCollections: "preview", // "Public previews only"
  myOrders: "full", // "If connected to a Shopify customer" — page itself is reachable
  myCollection: "none", // "No access"
  wishlist: "full", // "Full access"
  invitationsEvents: "preview", // "Public events only"
  storiesKnowledge: "preview", // "Public stories only"
  careRepair: "preview", // "Public guides only"
  myBenefits: "preview", // "Invitation to become a member"
  profile: "full", // "Full access"
  settings: "preview", // "Newsletter settings"
  helpSupport: "full", // "General customer support" — lower priority, but not blocked
};

const AREAS = Object.keys(EXPECTED_FOUNDING_AND_ANNUAL) as PdfArea[];

describe("getAccessLevel — Founding Member", () => {
  it.each(AREAS)("%s matches the PDF's access matrix", (area) => {
    expect(getAccessLevel("FOUNDING", area)).toBe(EXPECTED_FOUNDING_AND_ANNUAL[area]);
  });
});

describe("getAccessLevel — Annual Member", () => {
  it.each(AREAS)("%s matches the PDF's access matrix", (area) => {
    expect(getAccessLevel("ANNUAL", area)).toBe(EXPECTED_FOUNDING_AND_ANNUAL[area]);
  });
});

describe("getAccessLevel — Newsletter Subscriber", () => {
  it.each(AREAS)("%s matches the PDF's access matrix", (area) => {
    expect(getAccessLevel("NEWSLETTER", area)).toBe(EXPECTED_NEWSLETTER[area]);
  });
});

describe("getAccessLevel — Mongolia (not covered by the PDF)", () => {
  // The PDF predates the Mongolia Community decision (PROJECT_TRACKER.md Section
  // 3a) — MONGOLIA must default to the same restricted set as NEWSLETTER, never
  // to full access, until the client confirms Mongolia-specific rules. This is
  // the one row in the matrix that isn't "copy the spec" — it's a deliberate
  // safety default, so it gets its own explicit assertion rather than just being
  // parameterized alongside the others.
  it.each(AREAS)("%s defaults to the same restricted level as Newsletter", (area) => {
    expect(getAccessLevel("MONGOLIA", area)).toBe(EXPECTED_NEWSLETTER[area]);
  });

  it("never silently grants full access to a restricted area", () => {
    const restrictedAreas: PortalArea[] = ["memberOffers", "myCollection"];
    for (const area of restrictedAreas) {
      expect(getAccessLevel("MONGOLIA", area)).not.toBe("full");
    }
  });
});

describe("getAccessLevel — Founders' Design Lab (client email 2026-09-07/08, not the PDF)", () => {
  // Transcribed independently from the three real tier-homepage mockups
  // (Founder/Annual/Newsletter), not from access.ts's own implementation —
  // Founding has a full dedicated nav tab (view/save/vote); Annual gets a
  // homepage teaser leading to a preview (view/save, no vote — its own
  // mockup card mentions saving but never voting); Newsletter has no
  // presence at all; Mongolia isn't shown anywhere (international-only per
  // the client's own written scope).
  it("Founding gets full access", () => {
    expect(getAccessLevel("FOUNDING", "designLab")).toBe("full");
  });
  it("Annual gets preview access (view/save, no vote)", () => {
    expect(getAccessLevel("ANNUAL", "designLab")).toBe("preview");
  });
  it("Newsletter has no access", () => {
    expect(getAccessLevel("NEWSLETTER", "designLab")).toBe("none");
  });
  it("Mongolia has no access (international portal only)", () => {
    expect(getAccessLevel("MONGOLIA", "designLab")).toBe("none");
  });
});

describe("getAccessLevel — restricted-page enforcement", () => {
  // Mirrors the PDF's explicit requirement (page 5): restricted pages must be
  // blocked outright, not merely hidden from navigation. Confirms the "none"
  // level actually exists for the areas the PDF marks "No access" for Newsletter,
  // since RequireAccess (components/require-access.tsx) only blocks on "none" —
  // if this regressed to "preview" or "full", the redirect would silently stop
  // firing.
  it("Newsletter has no access to Member Offers", () => {
    expect(getAccessLevel("NEWSLETTER", "memberOffers")).toBe("none");
  });

  it("Newsletter has no access to My Collection", () => {
    expect(getAccessLevel("NEWSLETTER", "myCollection")).toBe("none");
  });

  it("Founding and Annual are never restricted from anything", () => {
    for (const area of AREAS) {
      expect(getAccessLevel("FOUNDING", area)).not.toBe("none");
      expect(getAccessLevel("ANNUAL", area)).not.toBe("none");
    }
  });
});
