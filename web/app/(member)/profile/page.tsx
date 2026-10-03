"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, FileText, Cookie, Trash2 } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import {
  formatMemberId,
  formatMonthYear,
  membershipTierLabel,
  updateMemberProfile,
  requestMemberData,
  fetchMemberDataRequests,
  type Gender,
  type DataSubjectRequest,
} from "@/lib/api";

// Reordered 2026-10-03 (client request): Membership now comes first so members
// see their level/status immediately, Personal Information second. Phone/
// Country of residence/Gender are new self-service fields here — unlike name/
// email, these are never Shopify-synced (see schema.prisma's Member comment),
// so they're editable directly. Email Preferences (a real marketing-consent
// toggle) is deliberately NOT here yet — postponed by the client until the
// Shopify consent integration is scoped, so building a decorative checkbox
// here would recreate the exact consent confusion that's being avoided.
export default function ProfilePage() {
  const member = useMember();

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Profile</h1>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Membership</h2>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Status"
            value={membershipTierLabel(member.membershipTier, member.isFoundingMember, member.region)}
          />
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

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Personal information</h2>
        <p className="mt-1 text-xs text-cashmere-text-muted">
          Name and email are managed through your Shopify account — update them there and they&apos;ll sync here.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" value={member.firstName ?? "—"} />
          <Field label="Last name" value={member.lastName ?? "—"} />
          <Field label="Email" value={member.email} className="sm:col-span-2" />
        </dl>

        <div className="mt-6 border-t border-cashmere-border pt-6">
          <PersonalDetailsForm
            initialPhoneNumber={member.phoneNumber}
            initialCountryOfResidence={member.countryOfResidence}
            initialGender={member.gender}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Data &amp; privacy</h2>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/privacy-policy"
            className="inline-flex items-center gap-2 rounded-full border border-cashmere-border px-4 py-2 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
          >
            <FileText size={16} strokeWidth={1.75} />
            Privacy Policy
          </Link>
          <Link
            href="/cookie-policy"
            className="inline-flex items-center gap-2 rounded-full border border-cashmere-border px-4 py-2 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
          >
            <Cookie size={16} strokeWidth={1.75} />
            Cookie Policy
          </Link>
        </div>

        <div className="mt-6 border-t border-cashmere-border pt-6">
          <DeletionRequest />
        </div>
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

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

function PersonalDetailsForm({
  initialPhoneNumber,
  initialCountryOfResidence,
  initialGender,
}: {
  initialPhoneNumber: string | null;
  initialCountryOfResidence: string | null;
  initialGender: Gender | null;
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [countryOfResidence, setCountryOfResidence] = useState(initialCountryOfResidence ?? "");
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      await updateMemberProfile({
        phoneNumber,
        countryOfResidence,
        gender: gender === "" ? undefined : gender,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-cashmere-text-muted">Phone number (optional)</span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              setStatus("idle");
            }}
            placeholder="e.g. +47 123 45 678"
            className="rounded-lg border border-cashmere-border px-3 py-2 text-sm text-cashmere-text focus:border-cashmere-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-cashmere-text-muted">Country of residence</span>
          <input
            type="text"
            value={countryOfResidence}
            onChange={(e) => {
              setCountryOfResidence(e.target.value);
              setStatus("idle");
            }}
            placeholder="e.g. Norway"
            className="rounded-lg border border-cashmere-border px-3 py-2 text-sm text-cashmere-text focus:border-cashmere-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-cashmere-text-muted">Gender (optional)</span>
          <select
            value={gender}
            onChange={(e) => {
              setGender(e.target.value as Gender | "");
              setStatus("idle");
            }}
            className="rounded-lg border border-cashmere-border bg-white px-3 py-2 text-sm text-cashmere-text focus:border-cashmere-accent focus:outline-none"
          >
            <option value="">Prefer not to answer / blank</option>
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-cashmere-text-muted">
        Used to tailor offers and information to your location — never affects your marketing consent.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="w-fit rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && <span className="text-sm text-cashmere-accent-dark">Saved</span>}
        {status === "error" && <span className="text-sm text-red-700">Something went wrong — try again.</span>}
      </div>
    </div>
  );
}

// Confirmation step before queuing a deletion request (client requirement,
// 2026-10-03) — this never deletes anything itself, it queues a DELETION-type
// DataSubjectRequest for staff to action (see data-subject-requests.service.ts).
function DeletionRequest() {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<DataSubjectRequest[] | null>(null);

  useEffect(() => {
    fetchMemberDataRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  const pending = requests?.find((r) => r.type === "DELETION" && r.status === "PENDING");

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const created = await requestMemberData("DELETION");
      setRequests((prev) => (prev ? [created, ...prev] : [created]));
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return (
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-cashmere-accent" />
        <p className="text-sm text-cashmere-text-muted">
          Your deletion request is pending since{" "}
          {new Date(pending.requestedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          . Our team will be in touch.
        </p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-900">
          This queues a request to permanently delete your account and personal data, handled by our support team.
          This doesn&apos;t happen instantly, and can&apos;t be undone once completed. Are you sure?
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-fit rounded-full bg-red-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60"
          >
            {submitting ? "Requesting…" : "Yes, request deletion"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={submitting}
            className="w-fit rounded-full border border-cashmere-border px-5 py-2 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:border-red-400"
    >
      <Trash2 size={16} strokeWidth={1.75} />
      Request deletion of my data
    </button>
  );
}
