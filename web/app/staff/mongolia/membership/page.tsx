"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMembers, MemberSummary } from "@/lib/staff-api";
import { membershipTierLabel } from "@/lib/api";

// Membership Access (Mongolia) — client's explicit instruction (2026-09-11):
// same underlying admin logic as the international CLC sections. No
// separate Mongolia member list — this is the exact same GET /members
// backend as /staff/members, filtered client-side to region MONGOLIA, and
// the exact same detail page on click (/staff/members/[id]) — deliberately
// unchanged — and the same Club Manager/Member Support role gate as the
// international page.
export default function MongoliaMembershipAccessPage() {
  const staff = useStaff();
  const router = useRouter();
  const allowed = staffHasAnyRole(staff, ["Club Manager", "Member Support"]);

  const [search, setSearch] = useState("");
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; members: MemberSummary[] }
  >({ status: "loading" });

  function load(query?: string) {
    fetchMembers(query)
      .then((members) => setState({ status: "loaded", members: members.filter((m) => m.region === "MONGOLIA") }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!allowed) {
      router.replace("/staff/mongolia");
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Membership Access</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Mongolia Newsletter and Mongolia Founding Members — look up a member by name or email.
        </p>
      </div>

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
          <p className="text-cashmere-text-muted">No Mongolia members match that search.</p>
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
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">{m.email}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-cashmere-text-muted">
                      {membershipTierLabel(m.membershipTier, m.isFoundingMember, m.region)}
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
