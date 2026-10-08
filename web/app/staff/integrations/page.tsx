"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchIntegrationsStatus, triggerMailchimpSync, IntegrationsStatus, MailchimpSyncResult } from "@/lib/staff-api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: IntegrationsStatus };

function StatusBadge({ ok, okLabel, notOkLabel }: { ok: boolean; okLabel: string; notOkLabel: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {ok ? okLabel : notOkLabel}
    </span>
  );
}

function NotBuiltBadge() {
  return (
    <span className="rounded-full bg-cashmere-sidebar px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cashmere-text-muted">
      Not built yet
    </span>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never received";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Technical Administrator per the seeded role description ("Technical
// operation: integrations, diagnostics and limited settings") — an exact
// match, server-side already enforces this on /integrations/status.
export default function IntegrationsPage() {
  const staff = useStaff();
  const router = useRouter();
  const canView = staffHasAnyRole(staff, ["Technical Administrator"]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [syncState, setSyncState] = useState<
    { status: "idle" } | { status: "syncing" } | { status: "done"; result: MailchimpSyncResult } | { status: "error"; message: string }
  >({ status: "idle" });

  useEffect(() => {
    if (!canView) {
      router.replace("/staff");
      return;
    }
    fetchIntegrationsStatus()
      .then((data) => setState({ status: "loaded", data }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [canView, router]);

  if (!canView) return null;

  async function handleMailchimpSync() {
    setSyncState({ status: "syncing" });
    try {
      const result = await triggerMailchimpSync();
      setSyncState({ status: "done", result });
    } catch (err) {
      setSyncState({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Integrations &amp; Settings</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Real connection status — no simulated state for anything not actually wired up yet.
        </p>
      </div>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load integrations status ({state.message}).
        </p>
      )}

      {state.status === "loaded" && (
        <>
          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-cashmere-text">Shopify</h2>
              <div className="flex gap-2">
                <StatusBadge
                  ok={state.data.shopify.oauthConfigured}
                  okLabel="OAuth configured"
                  notOkLabel="OAuth not configured"
                />
                <StatusBadge
                  ok={state.data.shopify.webhookSecretConfigured}
                  okLabel="Webhook secret set"
                  notOkLabel="Webhook secret missing"
                />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">Store domain</dt>
                <dd className="mt-0.5 text-cashmere-text">{state.data.shopify.shopDomain ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">Last order webhook received</dt>
                <dd className="mt-0.5 text-cashmere-text">{formatTimestamp(state.data.shopify.lastOrderWebhookAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-cashmere-text-muted">Last GDPR webhook received</dt>
                <dd className="mt-0.5 text-cashmere-text">{formatTimestamp(state.data.shopify.lastGdprWebhookAt)}</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-cashmere-border pt-3">
              <p className="text-xs uppercase tracking-wide text-cashmere-text-muted">Webhook endpoints registered in code</p>
              <ul className="mt-2 flex flex-col gap-1">
                {state.data.shopify.webhookEndpoints.map((endpoint) => (
                  <li key={endpoint} className="font-mono text-xs text-cashmere-text-muted">
                    {endpoint}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-cashmere-text">Database</h2>
              <StatusBadge ok={state.data.database.healthy} okLabel="Connected" notOkLabel="Unreachable" />
            </div>
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-cashmere-text">Mailchimp</h2>
              <div className="flex gap-2">
                <StatusBadge
                  ok={Boolean(state.data.mailchimp.apiKeyConfigured)}
                  okLabel="API key set"
                  notOkLabel="API key missing"
                />
                <StatusBadge
                  ok={Boolean(state.data.mailchimp.audienceIdConfigured)}
                  okLabel="Audience ID set"
                  notOkLabel="Audience ID missing"
                />
              </div>
            </div>
            <p className="mt-2 text-sm text-cashmere-text-muted">
              Creates a bare Shopify customer record (no email sent, no marketing consent touched) for every
              subscribed Mailchimp member who doesn&apos;t already have one — so they can log in with the existing
              passwordless Shopify sign-in. Run this whenever new subscribers should be able to log in; it&apos;s
              never automatic.
            </p>

            <div className="mt-4 border-t border-cashmere-border pt-4">
              <button
                type="button"
                onClick={handleMailchimpSync}
                disabled={syncState.status === "syncing"}
                className="rounded-full bg-cashmere-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark disabled:opacity-60"
              >
                {syncState.status === "syncing" ? "Syncing…" : "Sync Mailchimp subscribers now"}
              </button>

              {syncState.status === "done" && (
                <div className="mt-3 rounded-lg bg-cashmere-sidebar/60 px-4 py-3 text-sm text-cashmere-text">
                  <p>
                    {syncState.result.totalSubscribers} subscribed member{syncState.result.totalSubscribers === 1 ? "" : "s"} checked —{" "}
                    <strong>{syncState.result.created}</strong> new Shopify customer{syncState.result.created === 1 ? "" : "s"} created,{" "}
                    {syncState.result.alreadyExisted} already had one.
                  </p>
                  {syncState.result.failed.length > 0 && (
                    <div className="mt-2 text-red-700">
                      <p className="font-medium">{syncState.result.failed.length} failed:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {syncState.result.failed.map((f) => (
                          <li key={f.email}>
                            {f.email} — {f.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {syncState.status === "error" && (
                <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Could not run the sync ({syncState.message}).
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-cashmere-border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-cashmere-text">Content management (Strapi)</h2>
              <NotBuiltBadge />
            </div>
            <p className="mt-2 text-sm text-cashmere-text-muted">
              Proposed for Stories/News/Knowledge content, still an open architecture decision — not installed.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
