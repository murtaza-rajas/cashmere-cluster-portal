import { describe, expect, it } from "vitest";
import { annualPrice } from "./membership-offers";

describe("annualPrice", () => {
  it("is the launch price (NOK 2,350 / €199) up to and including 5 November (Oslo time)", () => {
    expect(annualPrice(new Date("2026-10-19T12:00:00Z"))).toEqual({ price: "€199", nok: "NOK 2,350", launchOffer: true });
    expect(annualPrice(new Date("2026-11-05T22:59:00Z"))).toEqual({ price: "€199", nok: "NOK 2,350", launchOffer: true });
  });

  it("is NOK 3,500 / €300 from 6 November", () => {
    expect(annualPrice(new Date("2026-11-05T23:00:00Z"))).toEqual({ price: "€300", nok: "NOK 3,500", launchOffer: false });
    expect(annualPrice(new Date("2027-02-01T00:00:00Z"))).toEqual({ price: "€300", nok: "NOK 3,500", launchOffer: false });
  });
});
