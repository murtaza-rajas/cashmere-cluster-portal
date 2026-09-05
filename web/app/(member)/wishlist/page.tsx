"use client";

import { useEffect, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { fetchWishlist, removeWishlistItem, WishlistItem } from "@/lib/api";

// Real feature, not a placeholder: reads/writes GET/DELETE /members/me/wishlist
// (member.controller.ts, backed by the new WishlistItem model). Full access for
// every tier per the client's spec (access matrix, page 5) — Wishlist is the one
// area Newsletter members get in full, since it doubles as a conversion tool.
//
// Always empty in practice until the storefront "Add to Wishlist" integration
// exists — per the client's confirmed flow (PROJECT_TRACKER.md Section 3c), that
// heart-icon click lives on CashmereHouse.com and needs its own auth design
// (frontend developer's territory), not yet resolved. This page and its API are
// our side of that integration, built ahead of it rather than waiting.
export default function WishlistPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; items: WishlistItem[] }
  >({ status: "loading" });

  useEffect(() => {
    fetchWishlist()
      .then((items) => setState({ status: "loaded", items }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, []);

  async function handleRemove(id: string) {
    setState((prev) =>
      prev.status === "loaded" ? { status: "loaded", items: prev.items.filter((i) => i.id !== id) } : prev,
    );
    try {
      await removeWishlistItem(id);
    } catch {
      // Re-sync from the server rather than guessing at the right rollback state.
      fetchWishlist()
        .then((items) => setState({ status: "loaded", items }))
        .catch((err: Error) => setState({ status: "error", message: err.message }));
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Wishlist</h1>
        <p className="mt-1 text-cashmere-text-muted">
          Products you&apos;ve saved from CashmereHouse.com.
        </p>
      </div>

      {state.status === "loading" && <p className="text-cashmere-text-muted">Loading your wishlist…</p>}

      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your wishlist ({state.message}). Try refreshing the page.
        </p>
      )}

      {state.status === "loaded" && state.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cashmere-border bg-white px-6 py-16 text-center">
          <Heart size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
          <p className="font-medium text-cashmere-text">Your wishlist is empty</p>
          <p className="max-w-sm text-sm text-cashmere-text-muted">
            Tap the heart icon on any product at CashmereHouse.com to save it here.
          </p>
        </div>
      )}

      {state.status === "loaded" && state.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-cashmere-border bg-white p-5">
              <div className="flex h-32 items-center justify-center rounded-lg bg-cashmere-sidebar/60">
                <Heart size={32} strokeWidth={1.5} className="text-cashmere-text-muted" />
              </div>
              <div>
                <p className="font-medium text-cashmere-text">{item.title}</p>
                {item.variantTitle && <p className="text-sm text-cashmere-text-muted">{item.variantTitle}</p>}
              </div>
              <div className="flex items-center justify-between border-t border-cashmere-border pt-3 text-xs text-cashmere-text-muted">
                <span>{item.price ? `€${item.price}` : ""}</span>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="flex items-center gap-1 text-cashmere-text-muted transition-colors hover:text-red-600"
                  aria-label={`Remove ${item.title} from wishlist`}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
