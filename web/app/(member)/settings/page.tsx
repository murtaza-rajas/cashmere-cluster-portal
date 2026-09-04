"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { fetchMemberDataRequests, requestMemberData, DataSubjectRequest } from "@/lib/api";
import { RequireAccess } from "@/components/require-access";

// Settings itself has no other confirmed content yet (Founding/Annual get "Full
// access" per the client's spec, but the spec doesn't say to what beyond the
// label) — rather than invent toggles nobody asked for, this page ships with
// exactly one real, complete feature: a GDPR self-service data request. That's a
// legal right independent of membership tier, so it's not gated by anything
// beyond having a session at all (RequireAccess still wraps the page since
// Settings itself is "full" for Founding/Annual per the matrix).
export default function SettingsPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; requests: DataSubjectRequest[] }
  >({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMemberDataRequests()
      .then((requests) => setState({ status: "loaded", requests }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, []);

  async function handleRequest() {
    setSubmitting(true);
    try {
      const created = await requestMemberData();
      setState((prev) =>
        prev.status === "loaded" && prev.requests.some((r) => r.id === created.id)
          ? prev
          : { status: "loaded", requests: [created, ...(prev.status === "loaded" ? prev.requests : [])] },
      );
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  const pending = state.status === "loaded" ? state.requests.find((r) => r.status === "PENDING") : undefined;

  return (
    <RequireAccess area="settings">
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-cashmere-text">Settings</h1>

        <section className="rounded-2xl border border-cashmere-border bg-white p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-cashmere-accent" />
            <div>
              <h2 className="font-semibold text-cashmere-text">Your data</h2>
              <p className="mt-1 text-sm text-cashmere-text-muted">
                Request a copy of the personal data we hold about you. Our team will prepare it and follow up by
                email.
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-cashmere-border pt-4">
            {state.status === "loading" && <p className="text-sm text-cashmere-text-muted">Loading…</p>}

            {state.status === "error" && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                Something went wrong ({state.message}). Try refreshing the page.
              </p>
            )}

            {state.status === "loaded" && pending && (
              <p className="text-sm text-cashmere-text-muted">
                Request pending since{" "}
                {new Date(pending.requestedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                . We&apos;ll be in touch.
              </p>
            )}

            {state.status === "loaded" && !pending && (
              <button
                onClick={handleRequest}
                disabled={submitting}
                className="rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
              >
                {submitting ? "Requesting…" : "Request my data"}
              </button>
            )}
          </div>
        </section>
      </div>
    </RequireAccess>
  );
}
