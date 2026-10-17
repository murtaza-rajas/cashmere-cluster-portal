"use client";

import { Check, Minus } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { MEMBERSHIP_PRODUCT_URLS } from "@/lib/store-links";
import { SHIPPING_NOTE, annualPrice } from "@/lib/membership-offers";

// Copy is the client's own: originally CLC_Membership_Text_EN_Updated.docx
// (2026-10-05), updated per his revised illustration and notes (2026-10-14):
// full benefit lists, Design Lab voting for Founding only, 15%/10% discounts
// for 6-Month and Annual (20%/15% for Founding), welcome gifts sent after one
// month, and the USA shipping/duties note on Annual and Founding. Updated
// 2026-10-17: buttons link to the store products, USA USD 40 / Asia USD 70
// shipping (duties not included), Annual launch price €200 until 5 November.
//
// Not gated — it's where Newsletter members are sent to upgrade.

const PAID_BENEFITS = [
  "Club News / CLC Update",
  "Exclusive collections",
  "Events & invitations",
  "Care & repair guides",
  "My Collection",
  "Wishlist and personal profile",
  "Newsletter",
];

export default function ExploreMembershipPage() {
  const member = useMember();
  const annual = annualPrice();

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Explore Membership</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Choose your membership and discover a closer connection to cashmere.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TierCard
          title="Newsletter"
          price="Free"
          tagline="Stay connected to the world of cashmere."
          current={member.membershipTier === "NEWSLETTER"}
          features={[
            "Newsletter with stories and inspiration",
            "Selected Stories & Knowledge",
            "Collection previews",
            "Wishlist and personal profile",
          ]}
        />
        <TierCard
          title="6-Month Member"
          price="€160"
          term="6-month membership · One-time payment."
          tagline="Six months of cashmere, stories and exclusive benefits."
          badge="Available in Norway only"
          gift={["Welcome cashmere wrist warmers · value €99.", "Sent after one month."]}
          discount="15% off until 31 March 2027, 10% member discount thereafter."
          current={member.membershipTier === "SIX_MONTH"}
          buttonLabel="Become a 6-Month Member"
          href={MEMBERSHIP_PRODUCT_URLS.sixMonth}
          features={[
            "Full Stories & Knowledge access",
            "Member offers and early access",
            "Explore and save designs in the Design Lab",
            ...PAID_BENEFITS,
          ]}
        />
        <TierCard
          title="Annual Member"
          price={annual.price}
          term={
            annual.launchOffer
              ? "12-month membership. Launch price for the first year, until 5 November — €300 from 6 November."
              : "12-month membership."
          }
          tagline="A year of cashmere, stories and exclusive benefits."
          gift={["Welcome scarf · value €169.", "Sent after one month."]}
          discount="15% off until 31 March 2027, 10% member discount thereafter."
          note={SHIPPING_NOTE}
          current={member.membershipTier === "ANNUAL" && !member.isFoundingMember}
          buttonLabel="Become an Annual Member"
          href={MEMBERSHIP_PRODUCT_URLS.annual}
          features={[
            "Full Stories & Knowledge access",
            "Member offers and early access",
            "Explore and save designs in the Design Lab",
            ...PAID_BENEFITS,
          ]}
        />
        <TierCard
          title="Founding Member"
          price="€1,000"
          term="5-year membership."
          tagline="Join from the beginning and help shape what comes next."
          badge="Limited to 1,500 members"
          gift={["Welcome blanket · value €599.", "Sent after one month."]}
          discount="20% off until 31 March 2027, 15% member discount thereafter."
          note={SHIPPING_NOTE}
          current={member.isFoundingMember}
          buttonLabel="Become a Founding Member"
          href={MEMBERSHIP_PRODUCT_URLS.founding}
          features={[
            "Full Stories & Knowledge access",
            "Exclusive offers and early access",
            "Explore and save designs in the Design Lab",
            "Vote for your favourites in the Design Lab",
            ...PAID_BENEFITS,
          ]}
        />
      </div>

      <p className="rounded-lg bg-cashmere-sidebar/60 px-4 py-3 text-sm text-cashmere-text-muted">
        The Club opens on 1 November 2026. Memberships bought before then start on 1 November; from 1 November
        they start on the day you buy.
      </p>

      <ComparisonTable />
    </div>
  );
}

function TierCard({
  title,
  price,
  term,
  tagline,
  badge,
  gift,
  discount,
  note,
  current,
  buttonLabel,
  href,
  features,
}: {
  title: string;
  price: string;
  term?: string;
  tagline: string;
  badge?: string;
  gift?: [string, string];
  discount?: string;
  note?: string;
  current: boolean;
  buttonLabel?: string;
  href?: string;
  features: string[];
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 ${
        current ? "border-cashmere-accent-dark ring-1 ring-cashmere-accent-dark" : "border-cashmere-border"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl text-cashmere-text">{title}</h2>
          {badge && (
            <span className="rounded-full bg-cashmere-sidebar px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cashmere-text-muted">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 font-serif text-3xl text-cashmere-text">{price}</p>
        {term && <p className="text-sm text-cashmere-text-muted">{term}</p>}
        <p className="mt-2 text-sm text-cashmere-text">{tagline}</p>
      </div>

      {gift && (
        <p className="rounded-lg bg-cashmere-sidebar/70 px-3 py-2 text-sm text-cashmere-text">
          {gift[0]}
          <br />
          <span className="text-cashmere-text-muted">{gift[1]}</span>
        </p>
      )}

      <ul className="flex flex-col gap-2 text-sm text-cashmere-text">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-cashmere-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-3">
        {(discount || note) && (
          <div className="flex flex-col gap-1 text-xs text-cashmere-text-muted">
            {discount && <p>{discount}</p>}
            {note && <p>{note}</p>}
          </div>
        )}
        {buttonLabel && href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-cashmere-accent-dark px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-cashmere-accent"
          >
            {buttonLabel}
          </a>
        )}
      </div>
    </div>
  );
}

type Cell = boolean | string;
const COMPARISON: { feature: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { feature: "Newsletter", cells: [true, true, true, true] },
  { feature: "Club News / CLC Update", cells: [false, true, true, true] },
  { feature: "Stories & Knowledge", cells: ["Selected", "Full", "Full", "Full"] },
  { feature: "Collection previews", cells: [true, true, true, true] },
  { feature: "Exclusive collections", cells: [false, true, true, true] },
  { feature: "Member offers and early access", cells: [false, true, true, "Exclusive"] },
  { feature: "Explore and save designs in the Design Lab", cells: [false, true, true, true] },
  { feature: "Vote in the Design Lab", cells: [false, false, false, true] },
  { feature: "Events & invitations", cells: [false, true, true, true] },
  { feature: "Care & repair guides", cells: [false, true, true, true] },
  { feature: "My Collection", cells: [false, true, true, true] },
  { feature: "Wishlist and personal profile", cells: [true, true, true, true] },
  { feature: "Welcome gift (sent after one month)", cells: [false, "Wrist warmers · €99", "Scarf · €169", "Blanket · €599"] },
  { feature: "Member discount", cells: [false, "15%, then 10%", "15%, then 10%", "20%, then 15%"] },
];

function ComparisonTable() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl tracking-tight text-cashmere-text">Compare memberships</h2>
      <div
        tabIndex={0}
        role="region"
        aria-label="Membership comparison table"
        className="overflow-x-auto rounded-2xl border border-cashmere-border bg-white focus-visible:outline-2 focus-visible:outline-cashmere-accent"
      >
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-cashmere-border bg-cashmere-sidebar/60 text-xs uppercase tracking-wide text-cashmere-text-muted">
            <tr>
              <th className="sticky left-0 w-32 bg-cashmere-sidebar px-3 py-3 font-medium sm:w-auto sm:px-4">Benefit</th>
              <th className="px-3 py-3 text-center font-medium">Newsletter</th>
              <th className="px-3 py-3 text-center font-medium">6-Month</th>
              <th className="px-3 py-3 text-center font-medium">Annual</th>
              <th className="px-3 py-3 text-center font-medium">Founding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cashmere-border">
            {COMPARISON.map(({ feature, cells }) => (
              <tr key={feature}>
                <th scope="row" className="sticky left-0 w-32 bg-white px-3 py-3 text-xs font-normal text-cashmere-text sm:w-auto sm:px-4 sm:text-sm">
                  {feature}
                </th>
                {cells.map((cell, i) => (
                  <td key={i} className="px-2 py-3 text-center text-cashmere-text sm:px-3">
                    {cell === true ? (
                      <Check size={16} strokeWidth={2} className="mx-auto text-cashmere-accent" aria-label="Included" />
                    ) : cell === false ? (
                      <Minus size={16} strokeWidth={2} className="mx-auto text-cashmere-border" aria-label="Not included" />
                    ) : (
                      <span className="text-xs">{cell}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-cashmere-text-muted">
        Discounts: the higher rate applies until 31 March 2027. 6-Month membership is available in Norway only.
      </p>
    </section>
  );
}
