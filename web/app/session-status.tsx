"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, fetchCurrentMember } from "@/lib/api";

type Status = { state: "loading" } | { state: "signed-out" } | { state: "error"; message: string };

const initialStatus: Status = API_URL ? { state: "loading" } : { state: "error", message: "NEXT_PUBLIC_API_URL is not set" };

// Proves the frontend and backend actually talk to each other: on load, asks the
// API (via the httpOnly session cookie — see api/src/auth/auth.controller.ts) who's
// currently logged in. If already signed in, sends them straight to /dashboard
// rather than showing a redundant "welcome back" message on this page too. The
// Shopify OAuth round-trip itself can't be completed until there's a real Shopify
// client ID + a public HTTPS redirect URI (see PROJECT_TRACKER.md Section 11), but
// this button and this check are real and wired up correctly regardless.
export default function SessionStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);

  useEffect(() => {
    if (!API_URL) return;

    fetchCurrentMember()
      .then((member) => {
        if (member) {
          router.replace("/dashboard");
          return;
        }
        setStatus({ state: "signed-out" });
      })
      .catch((err: Error) => setStatus({ state: "error", message: err.message }));
  }, [router]);

  if (status.state === "loading") {
    return <p className="text-zinc-500">Checking session…</p>;
  }

  if (status.state === "error") {
    return (
      <p className="text-red-600">
        Could not reach the API ({status.message}). Is it running at {API_URL}?
      </p>
    );
  }

  return (
    <a
      href={`${API_URL}/auth/shopify/login`}
      className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      Sign in with Shopify
    </a>
  );
}
