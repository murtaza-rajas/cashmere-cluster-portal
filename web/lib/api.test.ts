import { describe, it, expect, vi, afterEach } from "vitest";
import { formatMonthYear, formatMemberId, membershipTierLabel, fetchCurrentMember, fetchMemberOrders } from "./api";

describe("formatMonthYear", () => {
  it("formats an ISO date as 'Month Year'", () => {
    expect(formatMonthYear("2026-03-15T00:00:00.000Z")).toBe("March 2026");
  });

  it("handles a date at the start of a month correctly (no off-by-one)", () => {
    expect(formatMonthYear("2026-01-01T00:00:00.000Z")).toBe("January 2026");
  });
});

describe("formatMemberId", () => {
  it("builds a CLUB- prefixed id from the first 6 hex chars of the UUID, uppercased", () => {
    expect(formatMemberId("e6fd83aa-1fb2-4f5c-bdcb-d86252f51bfd")).toBe("CLUB-E6FD83");
  });
});

describe("membershipTierLabel", () => {
  // isFoundingMember is a permanent flag independent of membershipTier (see
  // schema.prisma) and must always win regardless of what tier is passed —
  // that's the whole point of it being a separate field.
  it("shows 'Founding Member' whenever isFoundingMember is true, regardless of tier", () => {
    expect(membershipTierLabel("FOUNDING", true)).toBe("Founding Member");
    expect(membershipTierLabel("ANNUAL", true)).toBe("Founding Member");
    expect(membershipTierLabel("NEWSLETTER", true)).toBe("Founding Member");
  });

  it("shows 'Annual Member' for ANNUAL tier when not a Founding Member", () => {
    expect(membershipTierLabel("ANNUAL", false)).toBe("Annual Member");
  });

  it("shows 'Mongolia Community Member' for MONGOLIA tier", () => {
    // Regression test: this branch didn't exist originally, so a Mongolia
    // member's label silently fell through to "Newsletter Subscriber" until it
    // was caught and fixed manually. This is exactly the kind of thing an
    // automated test should have caught the first time.
    expect(membershipTierLabel("MONGOLIA", false)).toBe("Mongolia Community Member");
  });

  it("shows 'Newsletter Subscriber' for NEWSLETTER tier when not a Founding Member", () => {
    expect(membershipTierLabel("NEWSLETTER", false)).toBe("Newsletter Subscriber");
  });
});

// NEXT_PUBLIC_API_URL is set via vitest.config.ts's `test.env`, not here — lib/api.ts
// reads it into a module-level constant at import time (mirroring how Next.js
// actually inlines NEXT_PUBLIC_ vars at build time), so setting process.env from
// inside a test would always be too late to affect it.
describe("fetchCurrentMember / fetchMemberOrders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchCurrentMember returns null on a 401 (signed out), not an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, ok: false }));
    await expect(fetchCurrentMember()).resolves.toBeNull();
  });

  it("fetchCurrentMember throws on a non-401 error response, rather than silently returning null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, ok: false }));
    await expect(fetchCurrentMember()).rejects.toThrow(/500/);
  });

  it("fetchCurrentMember returns the parsed member on success", async () => {
    const member = { id: "abc", email: "a@example.com" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => member }));
    await expect(fetchCurrentMember()).resolves.toEqual(member);
  });

  it("fetchCurrentMember sends the session cookie (credentials: include)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    await fetchCurrentMember();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/members/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("fetchMemberOrders throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, ok: false }));
    await expect(fetchMemberOrders()).rejects.toThrow(/403/);
  });

  it("fetchMemberOrders returns the parsed order list on success", async () => {
    const orders = [{ id: "1", orderNumber: "#1001" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => orders }));
    await expect(fetchMemberOrders()).resolves.toEqual(orders);
  });
});
