"use client";

import { useEffect, useRef, useState } from "react";
import { requestStaffEmailCode, verifyStaffEmailCode } from "@/lib/api";

// Admin sign-in: a 6-digit code emailed to the staff member's address.
export function StaffSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (step === "email" ? emailRef : codeRef).current?.focus();
  }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestStaffEmailCode(email.trim());
      setStep("code");
      setCode("");
      setNotice(`If ${email.trim()} has a staff account, we've sent a 6-digit code. It's valid for 10 minutes.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyStaffEmailCode(email.trim(), code);
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-cashmere-border bg-white px-4 py-3 text-sm text-cashmere-text";
  const primary =
    "rounded-lg bg-cashmere-accent-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent disabled:opacity-60";

  return (
    <div className="flex min-h-screen items-center justify-center bg-cashmere-bg px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-serif text-2xl text-cashmere-text">Admin sign-in</h1>
        <p className="mt-1 text-sm text-cashmere-text-muted">Cashmere Lovers&rsquo; Club staff</p>

        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-6 flex flex-col gap-3">
            <label htmlFor="staff-sign-in-email" className="sr-only">
              Work email address
            </label>
            <input
              ref={emailRef}
              id="staff-sign-in-email"
              type="email"
              required
              autoComplete="email"
              placeholder="Work email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Sending…" : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={signIn} className="mt-6 flex flex-col gap-3">
            {notice && <p className="text-sm text-cashmere-text-muted">{notice}</p>}
            <label htmlFor="staff-sign-in-code" className="sr-only">
              6-digit code
            </label>
            <input
              ref={codeRef}
              id="staff-sign-in-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${input} text-center text-2xl tracking-[0.4em]`}
            />
            <button type="submit" disabled={busy || code.length !== 6} className={primary}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex justify-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => sendCode()}
                disabled={busy}
                className="text-cashmere-accent-dark underline underline-offset-2"
              >
                Send a new code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                  setNotice(null);
                }}
                className="text-cashmere-accent-dark underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
