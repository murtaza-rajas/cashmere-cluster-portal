import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — Cashmere Lovers Club",
};

// Verbatim text from the client's own drafted/reviewed document
// (2.1 Cookie_Policy_Cashmere_Lovers_Club_EN_Reviewed.docx, received 2026-10-03,
// see legal/ and PROJECT_TRACKER.md). This is legal copy — content and wording are
// Morten's own, not written or edited here. Only paragraph/address line breaks were
// added for on-screen readability; no wording was changed.
//
// Note: section 4's technology inventory is exactly as drafted — a placeholder
// listing which providers need reviewing (Shopify, Mailchimp, Google Analytics),
// not a completed inventory. See PROJECT_TRACKER.md for the open items this
// surfaces (the inventory itself, and the cookie consent interface this policy
// describes but doesn't exist in the app yet).
//
// Public page (not under (member)) — the policy itself describes a first-visit
// consent flow, so it has to be readable before anyone logs in.
export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-cashmere-bg">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-8 sm:py-16">
        <div>
          <Link href="/" className="text-sm text-cashmere-accent hover:underline">
            ← Cashmere Lovers Club
          </Link>
          <h1 className="mt-4 font-serif text-3xl tracking-tight text-cashmere-text sm:text-4xl">Cookie Policy</h1>
          <p className="mt-2 text-sm text-cashmere-text-muted">Proposed effective date: 1 November 2026</p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-cashmere-border bg-white p-6 text-cashmere-text sm:p-10">
        <Section title="1. About this policy">
          <p>
            This Cookie Policy explains how Cashmere Lovers Club uses cookies and similar technologies on
            member.cashmerehouse.com. It should be read together with our{" "}
            <Link href="/privacy-policy" className="text-cashmere-accent hover:underline">Privacy Policy</Link>,
            which explains how we process personal data and your rights.
          </p>
          <p>
            Cashmere Lovers Club is operated by Cashmere House Limited, Irish company number 775623, and is part of
            the CashmereHouse.com online store.
          </p>
        </Section>

        <Section title="2. What are cookies and similar technologies">
          <p>
            Cookies are small files stored on your device when you visit a website. They can help a website
            recognise your browser, maintain a login session and remember settings.
          </p>
          <p>
            Similar technologies include local storage, pixels and other identifiers that store information on your
            device or access information from it. This policy covers these technologies where applicable.
          </p>
          <p>
            Session cookies normally expire when your browsing session ends. Persistent cookies remain for a
            specified period or until deleted. First-party cookies are set by the website you visit, while
            third-party cookies are set by another provider.
          </p>
        </Section>

        <Section title="3. Categories of technologies">
          <Sub title="Strictly necessary">
            <p>
              These technologies support services you explicitly request, such as secure login, maintaining a
              session or remembering consent choices. Where the conditions for the applicable legal exemption are
              met, they do not require consent. This exemption is not used for advertising or optional analytics.
            </p>
          </Sub>
          <Sub title="Preferences and functionality">
            <p>
              These technologies may remember choices such as language or display settings. They require consent
              unless a specific legal exemption applies to the function you have requested.
            </p>
          </Sub>
          <Sub title="Analytics">
            <p>
              Optional analytics technologies may measure visits, navigation and use of features to help improve the
              portal. Where consent is required, they remain inactive until you accept them.
            </p>
          </Sub>
          <Sub title="Advertising and marketing">
            <p>
              Optional advertising technologies may measure campaigns, recognise visits or support personalised
              advertising. They remain inactive until you consent where required.
            </p>
          </Sub>
        </Section>

        <Section title="4. Cookie and technology inventory">
          <p>
            The published policy must include an inventory of the technologies actually used. Providers mentioned in
            the Privacy Policy do not necessarily set cookies in the membership portal.
          </p>
          <p>For each technology, the inventory must specify:</p>
          <List
            items={[
              "Its exact name or identifier.",
              "The provider and domain.",
              "Its category and specific purpose.",
              "Whether it is a cookie, local storage item, pixel or another technology.",
              "Its duration or expiry criteria.",
              "Whether it is first-party or third-party.",
              "Whether consent is required and when the technology is activated.",
              "A link to the provider's relevant privacy or cookie information, where applicable.",
            ]}
          />
          <Sub title="Services to be reviewed">
            <p>Shopify, Mailchimp and Google Analytics receive tracking data.</p>
          </Sub>
        </Section>

        <Section title="5. Your choices">
          <p>
            On your first visit, where optional technologies are used, you can accept them, reject them or choose by
            purpose through the consent interface. Strictly necessary technologies may remain active to provide
            services you request.
          </p>
          <p>
            You can later change or withdraw your consent through the cookie settings. Withdrawing consent must be as
            easy as giving it. Withdrawal does not affect the lawfulness of processing already carried out.
          </p>
          <p>
            Rejecting optional technologies does not prevent access to core membership services. Certain optional
            features may be unavailable if they depend on technologies you have declined.
          </p>
          <p>
            Cookie consent is separate from consent to newsletters and other electronic marketing. Changing cookie
            choices does not automatically change your newsletter subscription or membership status.
          </p>
        </Section>

        <Section title="6. Browser settings">
          <p>Most browsers let you view, delete or block cookies through their privacy settings. Consult your browser&apos;s help pages for instructions.</p>
          <p>Deleting cookies may remove your saved consent choices, and you may be asked to choose again. Blocking strictly necessary cookies may affect login or other functions you request.</p>
          <p>Browser settings do not necessarily manage all similar technologies. Use the portal&apos;s cookie settings to manage optional technologies used by the portal.</p>
        </Section>

        <Section title="7. Personal data and international transfers">
          <p>Cookies and similar technologies may process personal data, such as device identifiers, IP addresses and information about your visits.</p>
          <p>Our Privacy Policy explains the purposes and legal bases for processing, relevant recipients, retention and your rights.</p>
          <p>If a provider receives personal data outside the EEA, a valid transfer mechanism and any necessary supplementary safeguards must be in place.</p>
        </Section>

        <Section title="8. Retention">
          <p>
            Cookie lifetimes and other technology durations are listed in the verified inventory. Data collected
            through these technologies may have a separate retention period, described in our Privacy Policy or the
            relevant provider information.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>We may update this policy when the technologies used, our services or legal requirements change. The current version will be published with an updated date.</p>
          <p>Where a new purpose or change requires fresh consent, the relevant optional technology will not be activated until that consent has been obtained.</p>
        </Section>

        <Section title="10. Contact us">
          <p>For questions about cookies or personal data, contact:</p>
          <Address />
        </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-cashmere-border pt-6">
      <h2 className="font-serif text-xl text-cashmere-text">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-cashmere-text-muted">{title}</h3>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Address() {
  return (
    <div className="rounded-lg border border-cashmere-border bg-cashmere-sidebar/50 p-4 text-sm">
      <p>Cashmere House Limited — Cashmere Lovers Club</p>
      <p>Irish company number: 775623</p>
      <p className="mt-2">Contact address: Dyrefaret 25, 1362 Hosle, Norway</p>
      <p>
        Email:{" "}
        <a href="mailto:privacy@cashmerehouse.no" className="text-cashmere-accent hover:underline">
          privacy@cashmerehouse.no
        </a>
      </p>
      <p>Membership portal: member.cashmerehouse.com</p>
      <p>Website: cashmerehouse.com</p>
      <p className="mt-2">Registered office:</p>
      <p>60 Merrion Square South</p>
      <p>Dublin 2, D02 HE24</p>
      <p>Ireland</p>
    </div>
  );
}
