// Annual launch price (client decision 2026-10-17): €200 for the first year
// up to and including 5 November 2026, €300 from 6 November (Oslo time).
export const ANNUAL_LAUNCH_PRICE_ENDS = new Date("2026-11-05T23:00:00Z"); // 6 Nov 00:00 CET

export function annualPrice(now: Date = new Date()): { price: string; launchOffer: boolean } {
  return now < ANNUAL_LAUNCH_PRICE_ENDS ? { price: "€200", launchOffer: true } : { price: "€300", launchOffer: false };
}

export const SHIPPING_NOTE =
  "Welcome gift shipping outside Norway: USA USD 40, Asia USD 70. Customs duties and import taxes are not included and are paid by the customer.";
