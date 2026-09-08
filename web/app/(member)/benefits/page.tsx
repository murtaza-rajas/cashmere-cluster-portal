"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useMember } from "@/contexts/member-context";
import { RequireAccess } from "@/components/require-access";
import { getAccessLevel } from "@/lib/access";
import { fetchMyBenefits, type Benefit } from "@/lib/api";
import { resolveBenefitIcon } from "@/lib/benefit-icons";

export default function BenefitsPage() {
  const member = useMember();
  const isPreview = getAccessLevel(member.membershipTier, "myBenefits") === "preview";

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: Benefit[] }
  >({ status: "loading" });

  useEffect(() => {
    if (isPreview) return;
    fetchMyBenefits()
      .then((rows) => setState({ status: "loaded", rows }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [isPreview]);

  if (isPreview) {
    return (
      <RequireAccess area="myBenefits">
        <div className="flex max-w-2xl flex-col gap-6">
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">My Benefits</h1>
          <div className="rounded-2xl border border-cashmere-border bg-white p-8 text-center">
            <Sparkles size={28} strokeWidth={1.5} className="mx-auto text-cashmere-accent" />
            <h2 className="mt-4 font-serif text-xl tracking-tight text-cashmere-text">Become a Member</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-cashmere-text-muted">
              Founding and Annual members get a welcome gift, a member discount, early access to new collections
              and more. Join to see your full benefits here.
            </p>
            <a
              href="/explore-membership"
              className="mt-6 inline-block rounded-full bg-cashmere-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent-dark"
            >
              Explore Membership
            </a>
          </div>
        </div>
      </RequireAccess>
    );
  }

  const tier = member.membershipTier === "FOUNDING" ? "FOUNDING" : "ANNUAL";

  return (
    <RequireAccess area="myBenefits">
      <div className="flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">My Benefits</h1>
          <p className="mt-1 text-cashmere-text-muted">
            {tier === "FOUNDING" ? "As a Founding Member, you receive:" : "As an Annual Member, you receive:"}
          </p>
        </div>

        {state.status === "loading" && <p className="text-cashmere-text-muted">Loading your benefits…</p>}
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load your benefits ({state.message}).
          </p>
        )}

        {state.status === "loaded" && (
          <div className="overflow-hidden rounded-2xl border border-cashmere-border bg-white">
            {state.rows.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-cashmere-text-muted">
                Your benefits will appear here soon.
              </p>
            )}
            {state.rows.map((row, index) => {
              const Icon = resolveBenefitIcon(row.icon);
              return (
                <div
                  key={row.id}
                  className={`flex items-start gap-4 px-6 py-4 ${index > 0 ? "border-t border-cashmere-border" : ""}`}
                >
                  <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cashmere-accent" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-text-muted">
                      {row.title}
                    </p>
                    {row.description && <p className="mt-0.5 font-medium text-cashmere-text">{row.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tier === "FOUNDING" && (
          <p className="rounded-lg bg-cashmere-accent/10 px-4 py-3 text-sm text-cashmere-accent-dark">
            Your Founding Member status is permanent — it stays with your account even if your paid term isn&apos;t
            renewed.
          </p>
        )}
      </div>
    </RequireAccess>
  );
}
