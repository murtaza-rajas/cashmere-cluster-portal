"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { API_URL, fetchEmailSignInAvailable, requestEmailCode, verifyEmailCode } from "@/lib/api";
import { CookieSettingsButton } from "@/components/cookie-consent";

const CLUB_PAGE = "https://www.cashmerehouse.com/pages/cashmere-lovers-club";

// Sign-in panel shown over the homepage (client design 2026-10-14): email
// code for newsletter members, Shopify for Annual & Founding. The email code
// also works for paying members — useful when Shopify asks for an SMS to a
// phone they don't have with them.
export function SignInPanel() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Hidden until email sending is configured on the server.
  const [emailAvailable, setEmailAvailable] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEmailSignInAvailable()
      .then(setEmailAvailable)
      .catch(() => setEmailAvailable(false));
  }, []);

  useEffect(() => {
    (step === "email" ? emailRef : codeRef).current?.focus();
  }, [step, emailAvailable]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestEmailCode(email.trim());
      setStep("code");
      setCode("");
      setNotice(`If ${email.trim()} belongs to a member, we've sent a 6-digit code. It's valid for 10 minutes.`);
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
      await verifyEmailCode(email.trim(), code);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
      className="w-full max-w-md rounded-3xl bg-cashmere-bg p-6 text-center shadow-2xl sm:p-8"
    >
      <h1 id="sign-in-title" className="font-serif text-3xl leading-tight text-cashmere-text">
        Welcome to
        <br />
        Cashmere Lovers&rsquo; Club
      </h1>

      {emailAvailable && (
        <>
      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-3">
          <h2 className="font-serif text-xl text-cashmere-text">Newsletter Members</h2>
          <p className="-mt-2 text-sm text-cashmere-text-muted">Sign in with your newsletter email address.</p>
          <label htmlFor="sign-in-email" className="sr-only">
            Email address
          </label>
          <input
            ref={emailRef}
            id="sign-in-email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-cashmere-border bg-white px-4 py-3 text-sm text-cashmere-text"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-cashmere-accent-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent disabled:opacity-60"
          >
            {busy ? "Sending…" : "Continue with email"}
          </button>
          <p className="text-xs text-cashmere-text-muted">We&apos;ll send you a one-time sign-in code.</p>
        </form>
      ) : (
        <form onSubmit={signIn} className="mt-6 flex flex-col gap-3">
          <h2 className="font-serif text-xl text-cashmere-text">Enter your code</h2>
          {notice && <p className="-mt-1 text-sm text-cashmere-text-muted">{notice}</p>}
          <label htmlFor="sign-in-code" className="sr-only">
            6-digit code
          </label>
          <input
            ref={codeRef}
            id="sign-in-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-cashmere-border bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-cashmere-text"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-lg bg-cashmere-accent-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex justify-center gap-4 text-xs">
            <button type="button" onClick={() => sendCode()} disabled={busy} className="text-cashmere-accent-dark underline underline-offset-2">
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

      <div className="my-6 h-px bg-cashmere-border" />
        </>
      )}


      <h2 className="font-serif text-xl text-cashmere-text">Annual &amp; Founding Members</h2>
      <a
        href={`${API_URL}/auth/shopify/login`}
        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-cashmere-navy px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-navy-dark"
      >
        <ShoppingBag size={18} strokeWidth={1.75} />
        Sign in with Shopify
      </a>
      <p className="mt-2 text-xs text-cashmere-text-muted">Use the email address linked to your membership.</p>

      <a
        href={CLUB_PAGE}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block font-serif text-lg text-cashmere-text underline underline-offset-4"
      >
        Explore memberships
      </a>

      <p className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-cashmere-text-muted">
        <Link href="/privacy-policy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        <Link href="/cookie-policy" className="underline underline-offset-2">
          Cookie Policy
        </Link>
        <CookieSettingsButton className="underline underline-offset-2" />
      </p>
    </div>
  );
}
