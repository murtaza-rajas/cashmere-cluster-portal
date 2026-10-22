"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMembers, grantMembership, GrantMembershipInput, MemberSummary } from "@/lib/staff-api";
import { membershipTierLabel } from "@/lib/api";

// Members & Users admin (Milestone 5) — Club Manager or Member Support, matching
// the server-side @Roles guard on GET /members. The one admin area that lets
// staff look up a specific member without going through the GDPR queue.
export default function StaffMembersPage() {
  const staff = useStaff();
  const router = useRouter();
  const allowed = staffHasAnyRole(staff, ["Club Manager", "Member Support"]);
  // Granting paid access is Club Manager only (matches POST /members).
  const canGrant = staffHasAnyRole(staff, ["Club Manager"]);

  const [search, setSearch] = useState("");
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; members: MemberSummary[] }
  >({ status: "loading" });

  function load(query?: string) {
    fetchMembers(query)
      .then((members) => setState({ status: "loaded", members }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!allowed) {
      router.replace("/staff");
      return;
    }
    load();
  }, [allowed, router]);

  if (!allowed) return null;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    load(search || undefined);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Members &amp; Users</h1>
        <p className="mt-1 text-cashmere-text-muted">Look up a member by name or email.</p>
      </div>

      {canGrant && <GrantMembershipPanel onGranted={() => load(search || undefined)} />}

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} strokeWidth={1.75} className="absolute top-1/2 left-3 -translate-y-1/2 text-cashmere-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-cashmere-border py-2 pr-3 pl-9 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-cashmere-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
        >
          Search
        </button>
      </form>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load members ({state.message}).
        </p>
      )}

      {state.status === "loaded" && state.members.length === 0 && (
        <div className="rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <p className="text-cashmere-text-muted">No members match that search.</p>
        </div>
      )}

      {state.status === "loaded" && state.members.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cashmere-border bg-cashmere-sidebar/60 text-xs uppercase tracking-wide text-cashmere-text-muted">
                <tr>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Name</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Email</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Membership</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Newsletter</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cashmere-border">
                {state.members.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/staff/members/${m.id}`)}
                    className="cursor-pointer hover:bg-cashmere-sidebar/40"
                  >
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-cashmere-text">
                      {m.firstName ?? "—"} {m.lastName ?? ""}
                      {m.isDemo && <DemoTag />}
                    </td>
                    <td className="max-w-[16rem] truncate whitespace-nowrap px-6 py-4 text-cashmere-text-muted" title={m.email}>
                      {m.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                      {membershipTierLabel(m.membershipTier, m.isFoundingMember, m.region)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                      {newsletterLabel(m.newsletterSubscribed)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                      {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const GRANT_LEVELS: { value: GrantMembershipInput["tier"]; label: string }[] = [
  { value: "SIX_MONTH", label: "6-Month Member" },
  { value: "ANNUAL", label: "Annual Member" },
  { value: "FOUNDING", label: "Founding Member" },
  { value: "MONGOLIA", label: "Cashmere Lovers Club Mongolia" },
];

// Add a member by hand — pilot customers (client request 2026-10-17). If the
// email already belongs to a member, their level is changed instead. The
// membership starts today.
function GrantMembershipPanel({ onGranted }: { onGranted: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tier, setTier] = useState<GrantMembershipInput["tier"]>("ANNUAL");
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { member, created } = await grantMembership({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        tier,
        months,
      });
      const level = GRANT_LEVELS.find((l) => l.value === tier)?.label ?? tier;
      const until = member.membershipEndDate
        ? new Date(member.membershipEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "";
      setDone(
        `${created ? "Added" : "Updated"} ${member.email}: ${level} until ${until}. They sign in with Shopify using this email.`,
      );
      setEmail("");
      setFirstName("");
      setLastName("");
      onGranted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-2 rounded-full border border-cashmere-accent-dark px-5 py-2 text-sm font-medium text-cashmere-text transition-colors hover:bg-cashmere-sidebar/60"
      >
        <UserPlus size={16} strokeWidth={1.75} />
        Add or update a member
      </button>
    );
  }

  const field = "w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-cashmere-border bg-white p-6">
      <div>
        <h2 className="font-serif text-xl text-cashmere-text">Add or update a member</h2>
        <p className="mt-1 text-sm text-cashmere-text-muted">
          For pilot customers and other memberships given without a purchase. If the email already belongs to a member,
          their level is changed. The membership starts today. Mongolia members see the Mongolia site; all other levels
          see the international site.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-cashmere-text sm:col-span-2">
          Email
          <input id="grant-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-cashmere-text">
          First name (optional)
          <input id="grant-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-cashmere-text">
          Last name (optional)
          <input id="grant-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-cashmere-text">
          Membership level
          <select
            id="grant-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as GrantMembershipInput["tier"])}
            className={field}
          >
            {GRANT_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-cashmere-text">
          Length (months)
          <input
            id="grant-months"
            type="number"
            min={1}
            max={60}
            required
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className={field}
          />
        </label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {done && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{done}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-cashmere-accent-dark px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save membership"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm text-cashmere-text-muted underline underline-offset-2"
        >
          Close
        </button>
      </div>
    </form>
  );
}

function newsletterLabel(subscribed: boolean | null): string {
  if (subscribed === true) return "Subscribed";
  if (subscribed === false) return "Unsubscribed";
  return "—";
}

function DemoTag() {
  return (
    <span
      className="ml-2 rounded-full bg-cashmere-sidebar px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-text-muted"
      title="Demo account for previews — not counted in the dashboard or reports"
    >
      Demo
    </span>
  );
}
