"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchIntegrationsStatus, IntegrationsStatus } from "@/lib/staff-api";

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

  return (
    <div className="flex max-w-4xl flex-col gap-6">
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
              <NotBuiltBadge />
            </div>
            <p className="mt-2 text-sm text-cashmere-text-muted">
              Chosen as the email/newsletter platform, but the integration isn&apos;t built yet.
            </p>
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
