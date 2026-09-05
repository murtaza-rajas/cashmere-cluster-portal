"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import {
  fetchStaffDirectory,
  fetchRoles,
  createStaffUser,
  grantRole,
  revokeRole,
  StaffUser,
  RoleOption,
} from "@/lib/staff-api";

// Super Administrator only — server-side already enforces this on every
// underlying endpoint (StaffController), this is just the matching UI guard so
// a non-Super-Administrator staff member visiting the URL directly sees a
// redirect, not a page full of 403s.
export default function StaffDirectoryPage() {
  const staff = useStaff();
  const router = useRouter();
  const isSuperAdmin = staffHasAnyRole(staff, ["Super Administrator"]);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; directory: StaffUser[]; roles: RoleOption[] }
  >({ status: "loading" });
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingRoleByStaffId, setPendingRoleByStaffId] = useState<Record<string, string>>({});

  function load() {
    Promise.all([fetchStaffDirectory(), fetchRoles()])
      .then(([directory, roles]) => setState({ status: "loaded", directory, roles }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }

  useEffect(() => {
    if (!isSuperAdmin) {
      router.replace("/staff");
      return;
    }
    load();
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createStaffUser({ email: newEmail, name: newName });
      setNewEmail("");
      setNewName("");
      load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleGrant(staffUserId: string) {
    const roleName = pendingRoleByStaffId[staffUserId];
    if (!roleName) return;
    await grantRole(staffUserId, roleName);
    load();
  }

  async function handleRevoke(staffUserId: string, roleName: string) {
    await revokeRole(staffUserId, roleName);
    load();
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Staff &amp; Roles</h1>

      <section className="rounded-2xl border border-cashmere-border bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">Add staff account</h2>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Name</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide text-cashmere-text-muted">Email</label>
            <input
              required
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cashmere-border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-1 rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
          >
            <Plus size={16} strokeWidth={2} />
            {creating ? "Adding…" : "Add"}
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
        <p className="mt-2 text-xs text-cashmere-text-muted">
          Creating an account doesn&apos;t grant any role — that&apos;s a separate step below.
        </p>
      </section>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading staff directory…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load the staff directory ({state.message}).
        </p>
      )}

      {state.status === "loaded" && (
        <section className="flex flex-col gap-4">
          {state.directory.map((s) => (
            <div key={s.id} className="rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-cashmere-text">
                    {s.name} {!s.isActive && <span className="text-xs text-red-600">(inactive)</span>}
                  </p>
                  <p className="text-sm text-cashmere-text-muted">{s.email}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {s.roles.length === 0 && <span className="text-sm text-cashmere-text-muted">No roles</span>}
                {s.roles.map((roleName) => (
                  <span
                    key={roleName}
                    className="flex items-center gap-1 rounded-full bg-cashmere-accent/10 px-2.5 py-1 text-xs font-medium text-cashmere-accent-dark"
                  >
                    {roleName}
                    <button
                      onClick={() => handleRevoke(s.id, roleName)}
                      aria-label={`Revoke ${roleName} from ${s.name}`}
                      className="hover:text-red-600"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-cashmere-border pt-3">
                <select
                  value={pendingRoleByStaffId[s.id] ?? ""}
                  onChange={(e) => setPendingRoleByStaffId((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  className="rounded-lg border border-cashmere-border px-3 py-1.5 text-sm"
                >
                  <option value="">Grant a role…</option>
                  {state.roles
                    .filter((r) => !s.roles.includes(r.name))
                    .map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => handleGrant(s.id)}
                  disabled={!pendingRoleByStaffId[s.id]}
                  className="rounded-full border border-cashmere-border px-4 py-1.5 text-sm font-medium text-cashmere-text transition-colors hover:border-cashmere-accent disabled:opacity-50"
                >
                  Grant
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
