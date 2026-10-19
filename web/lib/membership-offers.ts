// Annual launch price (client decisions 2026-10-17/19): NOK 2,350 (shown as
// €199) for the first year up to and including 5 November 2026, then
// NOK 3,500 (€300) from 6 November (Oslo time). The store charges in NOK;
// euro amounts are shown as a guide.
export const ANNUAL_LAUNCH_PRICE_ENDS = new Date("2026-11-05T23:00:00Z"); // 6 Nov 00:00 CET

export function annualPrice(now: Date = new Date()): { price: string; nok: string; launchOffer: boolean } {
  return now < ANNUAL_LAUNCH_PRICE_ENDS
    ? { price: "€199", nok: "NOK 2,350", launchOffer: true }
    : { price: "€300", nok: "NOK 3,500", launchOffer: false };
}

export const SHIPPING_NOTE =
  "Welcome gift shipping outside Norway: USA USD 40, Asia USD 70. Customs duties and import taxes are not included and are paid by the customer.";

export const NOK_PAYMENT_NOTE =
  "Payment is in Norwegian kroner (NOK). Euro prices are a guide — the exact amount in euros depends on the exchange rate.";
