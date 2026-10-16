"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentMember, type Member } from "@/lib/api";
import { MemberProvider } from "@/contexts/member-context";
import Sidebar from "@/components/sidebar";
import { NewsletterHome } from "@/components/newsletter-home";
import { SignInPanel } from "@/components/sign-in-panel";

// Signed-out visitors see the live homepage behind the sign-in panel (client
// request 2026-10-14) — public content only: the same page a Newsletter
// member gets, with no name and data from the public /showcase endpoints.
// The page behind the panel is inert (not clickable or focusable).
const SHOWCASE_MEMBER: Member = {
  id: "showcase",
  email: "",
  firstName: null,
  lastName: null,
  membershipTier: "NEWSLETTER",
  membershipStatus: "ACTIVE",
  region: "INTERNATIONAL",
  language: "ENGLISH",
  isFoundingMember: false,
  termLengthMonths: null,
  membershipStartDate: null,
  membershipEndDate: null,
  createdAt: new Date(0).toISOString(),
  phoneNumber: null,
  countryOfResidence: null,
  gender: null,
};

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetchCurrentMember()
      .then((member) => {
        if (member) router.replace("/dashboard");
      })
      .catch(() => undefined);
  }, [router]);

  return (
    <div className="relative min-h-screen bg-cashmere-bg">
      <div inert aria-hidden="true" className="select-none">
        <MemberProvider member={SHOWCASE_MEMBER}>
          <div className="flex min-h-screen">
            <Sidebar open={false} onClose={() => undefined} />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
              <NewsletterHome displayName="" showcase />
            </main>
          </div>
        </MemberProvider>
      </div>

      <div className="fixed inset-0 z-40 bg-cashmere-text/30" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <SignInPanel />
      </div>
    </div>
  );
}
