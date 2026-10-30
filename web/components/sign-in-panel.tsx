"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { API_URL, fetchEmailSignInAvailable, joinClub, requestEmailCode, verifyEmailCode } from "@/lib/api";
import { CookieSettingsButton } from "@/components/cookie-consent";

const CLUB_PAGE = "https://www.cashmerehouse.com/pages/cashmere-lovers-club";

// Same wording the server stores with each join as the consent record.
const NEWSLETTER_CONSENT_TEXT =
  "Yes, I'd like to receive the Cashmere House newsletter. I can unsubscribe at any time.";

// Sign-in panel shown over the homepage (client design 2026-10-14): email
// code for newsletter members, Shopify for Annual & Founding. The email code
// also works for paying members — useful when Shopify asks for an SMS to a
// phone they don't have with them. "Join for free" (2026-10-30) lets someone
// who isn't a member yet become a Newsletter member and sign in at once.
export function SignInPanel() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "join" | "code">("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Hidden until email sending is configured on the server.
  const [emailAvailable, setEmailAvailable] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEmailSignInAvailable()
      .then(setEmailAvailable)
      .catch(() => setEmailAvailable(false));
  }, []);

  useEffect(() => {
    ({ email: emailRef, join: nameRef, code: codeRef })[step].current?.focus();
  }, [step, emailAvailable]);

  function goTo(next: "email" | "join") {
    setStep(next);
    setError(null);
    setNotice(null);
  }

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

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await joinClub(email.trim(), firstName.trim());
      setStep("code");
      setCode("");
      setNotice(
        `Welcome! We've sent a 6-digit code to ${email.trim()}. You'll also get an email from Mailchimp asking you to confirm the newsletter.`,
      );
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

  const input = "w-full rounded-lg border border-cashmere-border bg-white px-4 py-3 text-sm text-cashmere-text";
  const primary =
    "rounded-lg bg-cashmere-accent-dark px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cashmere-accent disabled:opacity-60";
  const textLink = "text-cashmere-accent-dark underline underline-offset-2";

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
          {step === "email" && (
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
                className={input}
              />
              <button type="submit" disabled={busy} className={primary}>
                {busy ? "Sending…" : "Continue with email"}
              </button>
              <p className="text-xs text-cashmere-text-muted">We&apos;ll send you a one-time sign-in code.</p>
              <p className="text-sm text-cashmere-text">
                Not a member yet?{" "}
                <button type="button" onClick={() => goTo("join")} className={textLink}>
                  Join for free
                </button>
              </p>
            </form>
          )}

          {step === "join" && (
            <form onSubmit={join} className="mt-6 flex flex-col gap-3 text-left">
              <h2 className="text-center font-serif text-xl text-cashmere-text">Join for free</h2>
              <p className="-mt-2 text-center text-sm text-cashmere-text-muted">
                Become a Newsletter Member: stories, collection previews and news from Cashmere House.
              </p>
              <label htmlFor="join-first-name" className="sr-only">
                First name
              </label>
              <input
                ref={nameRef}
                id="join-first-name"
                required
                autoComplete="given-name"
                placeholder="First name"
                maxLength={100}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={input}
              />
              <label htmlFor="join-email" className="sr-only">
                Email address
              </label>
              <input
                id="join-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
              <label htmlFor="join-consent" className="flex items-start gap-2.5 text-sm text-cashmere-text">
                <input
                  id="join-consent"
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-cashmere-accent-dark"
                />
                <span>
                  {NEWSLETTER_CONSENT_TEXT}{" "}
                  <Link href="/privacy-policy" className={textLink}>
                    Privacy Policy
                  </Link>
                </span>
              </label>
              <button type="submit" disabled={busy || !consent} className={primary}>
                {busy ? "Joining…" : "Join and get my sign-in code"}
              </button>
              <p className="text-center text-sm text-cashmere-text">
                Already a member?{" "}
                <button type="button" onClick={() => goTo("email")} className={textLink}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {step === "code" && (
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
                className={`${input} text-center text-2xl tracking-[0.4em]`}
              />
              <button type="submit" disabled={busy || code.length !== 6} className={primary}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <div className="flex justify-center gap-4 text-xs">
                <button type="button" onClick={() => sendCode()} disabled={busy} className={textLink}>
                  Send a new code
                </button>
                <button type="button" onClick={() => goTo("email")} className={textLink}>
                  Use a different email
                </button>
              </div>
              <p className="text-xs text-cashmere-text-muted">
                No code after a few minutes? Check your spam folder. Not a member yet?{" "}
                <button type="button" onClick={() => goTo("join")} className={textLink}>
                  Join for free
                </button>
              </p>
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
