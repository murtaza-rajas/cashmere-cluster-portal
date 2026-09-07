"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMembers, MemberSummary } from "@/lib/staff-api";
import { membershipTierLabel } from "@/lib/api";

// Members & Users admin (Milestone 5) — Club Manager or Member Support, matching
// the server-side @Roles guard on GET /members. The one admin area that lets
// staff look up a specific member without going through the GDPR queue.
export default function StaffMembersPage() {
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
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Members &amp; Users</h1>
        <p className="mt-1 text-cashmere-text-muted">Look up a member by name or email.</p>
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
                      {membershipTierLabel(m.membershipTier, m.isFoundingMember)}
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
