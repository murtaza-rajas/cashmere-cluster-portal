import { describe, expect, it } from "vitest";
import { annualPrice } from "./membership-offers";

describe("annualPrice", () => {
  it("is the €200 launch price up to and including 5 November (Oslo time)", () => {
    expect(annualPrice(new Date("2026-10-17T12:00:00Z"))).toEqual({ price: "€200", launchOffer: true });
    expect(annualPrice(new Date("2026-11-05T22:59:00Z"))).toEqual({ price: "€200", launchOffer: true });
  });

  it("is €300 from 6 November", () => {
    expect(annualPrice(new Date("2026-11-05T23:00:00Z"))).toEqual({ price: "€300", launchOffer: false });
    expect(annualPrice(new Date("2027-02-01T00:00:00Z"))).toEqual({ price: "€300", launchOffer: false });
  });
});
