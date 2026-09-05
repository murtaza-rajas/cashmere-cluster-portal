"use client";

import { Headset, Mail } from "lucide-react";
import { useMember } from "@/contexts/member-context";

// Support tier badge is real, confirmed content — the client's own spec PDF
// (cashmere-lovers-club-access-administration-model, page 5, "Customer portal
// access matrix": Help & Support = Priority / Standard / General). No real
// support contact channel (email/phone/hours) has been confirmed yet, so
// rather than invent one, this links to CashmereHouse.com — the real, live
// storefront, which already has its own contact channels — until the client
// gives a dedicated portal support address.
const SUPPORT_COPY: Record<string, { label: string; description: string }> = {
  FOUNDING: {
    label: "Priority Support",
    description: "As a Founding Member, your requests are handled with priority.",
  },
  ANNUAL: {
    label: "Standard Support",
    description: "As an Annual Member, you have access to standard member support.",
  },
  NEWSLETTER: {
    label: "General Support",
    description: "You have access to general customer support.",
  },
  MONGOLIA: {
    label: "General Support",
    description: "You have access to general customer support.",
  },
};

export default function HelpPage() {
  const member = useMember();
  const support = SUPPORT_COPY[member.membershipTier];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Help &amp; Support</h1>

      <div className="rounded-2xl border border-cashmere-border bg-white p-6">
        <div className="flex items-start gap-3">
          <Headset size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-cashmere-accent" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent">{support.label}</p>
            <p className="mt-1 text-sm text-cashmere-text-muted">{support.description}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-cashmere-border pt-4">
          <Mail size={18} strokeWidth={1.5} className="shrink-0 text-cashmere-text-muted" />
          <div>
            <p className="text-sm font-medium text-cashmere-text">Contact us</p>
            <a
              href="https://cashmerehouse.com"
              className="text-sm text-cashmere-accent hover:underline"
            >
              Visit CashmereHouse.com for contact options
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
