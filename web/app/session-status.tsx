"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Member {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  membershipTier: string;
}

type Status =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "signed-in"; member: Member }
  | { state: "error"; message: string };

const initialStatus: Status = API_URL
  ? { state: "loading" }
  : { state: "error", message: "NEXT_PUBLIC_API_URL is not set" };

// Proves the frontend and backend actually talk to each other: on load, asks the
// API (via the httpOnly session cookie — see api/src/auth/auth.controller.ts) who's
// currently logged in. The Shopify OAuth round-trip itself can't be completed until
// there's a real Shopify client ID + a public HTTPS redirect URI (see
// PROJECT_TRACKER.md Section 11), but this button and this check are real and wired
// up correctly regardless.
export default function SessionStatus() {
  const [status, setStatus] = useState<Status>(initialStatus);

  useEffect(() => {
    if (!API_URL) return;

    fetch(`${API_URL}/members/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          setStatus({ state: "signed-out" });
          return;
        }
        if (!res.ok) {
          throw new Error(`Unexpected response: ${res.status}`);
        }
        return res.json().then((member: Member) => setStatus({ state: "signed-in", member }));
      })
      .catch((err: Error) => setStatus({ state: "error", message: err.message }));
  }, []);

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

  if (status.state === "signed-in") {
    const { member } = status;
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-medium">Welcome back, {member.firstName ?? member.email}</p>
        <p className="text-sm text-zinc-500">Membership: {member.membershipTier}</p>
      </div>
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
