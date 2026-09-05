"use client";

import { useMember } from "@/contexts/member-context";
import { formatMemberId, formatMonthYear, membershipTierLabel } from "@/lib/api";

// No mockup exists for this specific page (only mockups for the post-login
// dashboard exist — see PROJECT_TRACKER.md Section 7) — designed to match the
// dashboard's visual style rather than a provided design. Contact details
// (name/email) are shown read-only on purpose: Shopify is the source of truth
// for identity (see PROJECT_TRACKER.md Section 3), so editing them here would
// create drift between what we show and what Shopify actually has. If a member
// needs to change their name/email, that happens through Shopify's own account
// management, not this portal.
export default function ProfilePage() {
  const member = useMember();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Profile</h1>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Contact details</h2>
        <p className="mt-1 text-xs text-cashmere-text-muted">
          Managed through your Shopify account — update your name or email there and it will sync here.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" value={member.firstName ?? "—"} />
          <Field label="Last name" value={member.lastName ?? "—"} />
          <Field label="Email" value={member.email} className="sm:col-span-2" />
        </dl>
      </section>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Membership</h2>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" value={membershipTierLabel(member.membershipTier, member.isFoundingMember)} />
          <Field label="Member ID" value={formatMemberId(member.id)} />
          <Field label="Member since" value={formatMonthYear(member.createdAt)} />
          <Field
            label="Term length"
            value={member.termLengthYears ? `${member.termLengthYears} year${member.termLengthYears > 1 ? "s" : ""}` : "—"}
          />
          {member.membershipStartDate && (
            <Field label="Current term started" value={formatMonthYear(member.membershipStartDate)} />
          )}
          {member.membershipEndDate && (
            <Field label="Current term ends" value={formatMonthYear(member.membershipEndDate)} />
          )}
        </dl>

        {member.isFoundingMember && (
          <p className="mt-4 rounded-lg bg-cashmere-accent/10 px-4 py-3 text-sm text-cashmere-accent-dark">
            Your Founding Member status is permanent — it stays with your account even if your paid term isn&apos;t
            renewed.
          </p>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-cashmere-text">{value}</dd>
    </div>
  );
}
