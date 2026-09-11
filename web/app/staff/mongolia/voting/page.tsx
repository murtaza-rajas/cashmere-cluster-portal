"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Vote, Factory } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";
import { fetchMongoliaProducerCatalog, StaffMongoliaProducer } from "@/lib/staff-api";

// "Your Voice / Voting" (client's mockup, 2026-09-11) — a read-only results
// view over the real per-producer votes already collected (see the
// MongoliaProducerVote model). Deliberately not a generic poll-builder —
// nothing was asked to create arbitrary polls/candidates, and Mongolia only
// has one real thing to vote on so far (producers); a fuller poll system is
// bigger, separate scope if that's ever actually needed.
export default function MongoliaVotingPage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);

  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; rows: StaffMongoliaProducer[] }
  >({ status: "loading" });

  useEffect(() => {
    if (!canManage) {
      router.replace("/staff/mongolia");
      return;
    }
    fetchMongoliaProducerCatalog()
      .then((rows) => setState({ status: "loaded", rows }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [canManage, router]);

  if (!canManage) return null;

  const sorted = state.status === "loaded" ? [...state.rows].sort((a, b) => b.voteCount - a.voteCount) : [];
  const totalVotes = sorted.reduce((sum, p) => sum + p.voteCount, 0);
  const topVotes = sorted[0]?.voteCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Your Voice / Voting</h1>
        <p className="mt-1 text-cashmere-text-muted">
          How Mongolia Founding Members are voting on producers — read-only results, votes are cast by members.
        </p>
      </div>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading…</p>}
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Could not load results ({state.message}).</p>
      )}

      {state.status === "loaded" && (
        <>
          <div className="flex items-center gap-2 rounded-2xl border border-cashmere-border bg-white p-4">
            <Vote size={18} strokeWidth={1.75} className="text-cashmere-accent-dark" />
            <p className="text-sm text-cashmere-text">
              <span className="font-semibold">{totalVotes}</span> total votes cast across {sorted.length} producer
              {sorted.length === 1 ? "" : "s"}
            </p>
          </div>

          {sorted.length === 0 && (
            <p className="rounded-2xl border border-cashmere-border bg-white p-6 text-center text-sm text-cashmere-text-muted">
              No producers yet — add one under Producers first.
            </p>
          )}

          {sorted.length > 0 && (
            <section className="flex flex-col gap-3">
              {sorted.map((row) => (
                <div key={row.id} className="flex items-center gap-4 rounded-2xl border border-cashmere-border bg-white p-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cashmere-sidebar/60">
                    {row.heroImageUrl ? (
                      <Image src={row.heroImageUrl} alt="" fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Factory size={18} strokeWidth={1.5} className="text-cashmere-text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-cashmere-text">{row.name}</p>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-cashmere-sidebar/60">
                      <div
                        className="h-full rounded-full bg-cashmere-accent"
                        style={{ width: topVotes > 0 ? `${(row.voteCount / topVotes) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                  <p className="w-16 shrink-0 text-right text-sm font-semibold text-cashmere-text">
                    {row.voteCount} {row.voteCount === 1 ? "vote" : "votes"}
                  </p>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
