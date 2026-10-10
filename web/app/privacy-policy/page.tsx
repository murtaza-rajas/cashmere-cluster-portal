import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Cashmere Lovers Club",
};

// Verbatim text from the client's own drafted/reviewed document
// (3.1 Privacy_Policy_Cashmere_Lovers_Club_EN_Reviewed.docx, received 2026-10-03,
// see legal/ and PROJECT_TRACKER.md). This is legal copy — content and wording are
// Morten's own, not written or edited here. Only paragraph/address line breaks were
// added for on-screen readability; no wording was changed.
//
// Public page (not under (member)) since members need to read this before logging
// in, and it's linked from the Profile page for signed-in members too.
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-cashmere-bg">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-8 sm:py-16">
        <div>
          <Link href="/" className="text-sm text-cashmere-accent hover:underline">
            ← Cashmere Lovers Club
          </Link>
          <h1 className="mt-4 font-serif text-3xl tracking-tight text-cashmere-text sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-cashmere-text-muted">Proposed effective date: 1 November 2026 — to be confirmed</p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-cashmere-border bg-white p-6 text-cashmere-text sm:p-10">
        <p>
          Cashmere Lovers Club respects your privacy. This Privacy Policy explains how we collect, use, store and
          protect personal data when you visit our membership portal, register as a member, subscribe to newsletters
          or use our services.
        </p>
        <p>
          Cashmere Lovers Club is operated by Cashmere House Limited, a company registered in Ireland. We process
          personal data in accordance with the General Data Protection Regulation (GDPR) and applicable Irish data
          protection legislation.
        </p>

        <Section title="1. Who is responsible for your personal data?">
          <p>The controller responsible for the processing described in this policy is:</p>
          <Address />
          <p>
            This policy applies to Cashmere Lovers Club, including membership administration, newsletters, member
            benefits, content and activities in the membership portal.
          </p>
          <p>
            When you purchase products from the online store, the store&apos;s privacy information also applies. If
            another business is responsible for a purchase or service, this will be clearly stated when you place
            your order.
          </p>
        </Section>

        <Section title="2. Personal data we collect">
          <Sub title="Information you provide">
            <p>When you register, update your profile or contact us, we may process:</p>
            <List
              items={[
                "Your name and email address.",
                "Your telephone number, including country code, if you choose to provide it.",
                "Your country of residence and selected language.",
                "Your delivery address where necessary to send a membership gift or another delivery.",
                "Information you include in enquiries to us.",
                "Choices and preferences saved in your membership profile.",
                "Consents, opt-outs and communication settings.",
              ]}
            />
            <p>
              Required fields are marked during registration. If you do not provide necessary information, we may be
              unable to create your membership or provide the relevant service.
            </p>
          </Sub>
          <Sub title="Membership and payments">
            <p>We may process information about:</p>
            <List
              items={[
                "Membership level and status.",
                "Start date, duration, renewal and cancellation.",
                "Payment status and transaction references.",
                "Member benefits, discount codes and membership gifts.",
                "Order information needed to administer member benefits.",
              ]}
            />
            <p>
              Payments are handled through our payment providers. The payment information we receive depends on the
              payment solution used in each region.
            </p>
          </Sub>
          <Sub title="Activity in the membership portal">
            <p>When you use Cashmere Lovers Club features, we may record:</p>
            <List
              items={[
                "Logins and account verification.",
                "Favourites and saved choices.",
                "Votes in the Design Lab and other membership activities.",
                "Content or contributions you submit.",
                "Your use of member benefits.",
              ]}
            />
            <p>
              If a contribution is to be published with your name or other identifying information, we will inform
              you before publication and establish any necessary permission.
            </p>
          </Sub>
          <Sub title="Technical information">
            <p>When you visit the membership portal, we may process:</p>
            <List
              items={[
                "Your IP address.",
                "Browser type, operating system and device information.",
                "Dates and times of visits and logins.",
                "Technical errors and security incidents.",
              ]}
            />
            <p>If you consent to optional analytics tools, we may also collect information about how you use the portal.</p>
          </Sub>
          <Sub title="Information from other systems">
            <p>
              Where necessary to administer your membership, we may receive information from connected systems, such
              as Shopify and our newsletter provider, Mailchimp. This may include a customer reference, payment
              status, relevant order information and newsletter subscription status.
            </p>
          </Sub>
        </Section>

        <Section title="3. How we use your data and our legal bases">
          <LegalBasisItem
            title="Creating and administering memberships"
            body="We use necessary information to create your membership account, verify logins, display your membership status and provide access to member benefits."
            basis="Performance of the membership agreement."
          />
          <LegalBasisItem
            title="Administering payments, renewals and membership gifts"
            body="We use relevant information to record payments, administer membership periods and send membership gifts where these are included in your membership."
            basis="Performance of the agreement and compliance with legal obligations where applicable."
          />
          <LegalBasisItem
            title="Providing membership activities"
            body="We use information about favourites, votes and other choices to provide the portal features you use and administer participation in accordance with the membership terms."
            basis="Performance of the membership agreement where processing is necessary for the relevant feature."
          />
          <LegalBasisItem
            title="Tailoring language and relevant membership information"
            body="We may use your country of residence, membership level and language selection to display relevant information and available member benefits. The use of this information for marketing is subject to the rules below."
            basis="Performance of the agreement where tailoring is necessary for the service, or our legitimate interest in making the membership portal relevant and user-friendly."
          />
          <LegalBasisItem
            title="Sending necessary membership information"
            body="We may send information about payments, membership status, security, changes to terms and other matters necessary for your membership."
            basis="Performance of the agreement, compliance with legal obligations or our legitimate interest in ensuring proper operation."
          />
          <LegalBasisItem
            title="Sending newsletters and marketing"
            body="We send newsletters, offers and other electronic marketing where you have consented or another lawful basis permits this. Membership does not automatically constitute consent to marketing. You can unsubscribe at any time using the link in our emails or by contacting us."
            basis="Consent where required. Any exceptions for existing customer relationships are used only where the applicable conditions are met."
          />
          <LegalBasisItem
            title="Registering newsletter subscribers as Newsletter Members"
            body="We use subscribers’ names and email addresses to create a Newsletter Member profile and a basic customer record so they can access the portal."
            basis="Legitimate interest."
          />
          <LegalBasisItem
            title="Responding to enquiries"
            body="We use contact details and messages to answer questions and help you with your membership."
            basis="Performance of the agreement or our legitimate interest in responding to enquiries."
          />
          <LegalBasisItem
            title="Operation, security and prevention of misuse"
            body="We use necessary technical information to protect accounts, investigate errors and prevent unauthorised access or misuse."
            basis="Our legitimate interest in operating a secure and reliable membership portal."
          />
          <LegalBasisItem
            title="Complying with legal obligations"
            body="We process information where necessary to comply with legal requirements, including accounting and record-keeping requirements."
            basis="Compliance with a legal obligation."
          />
        </Section>

        <Section title="4. Newsletters and Newsletter Membership">
          <p>
            Cashmere Lovers Club distinguishes between membership registration, access to the membership portal and
            consent to marketing.
          </p>
          <p>
            Newsletter subscribers are registered as Newsletter Members using the name and email address held by our
            newsletter provider, including a basic customer record in our online store so they can log in. No
            message is sent and marketing consent is not changed. If you unsubscribe, your newsletter status is
            removed; your profile is not deleted automatically, and you can ask us to delete it at any time.
          </p>
          <p>Registration does not authorise the use of their information for new marketing purposes without a valid legal basis.</p>
          <p>Access to the membership portal requires the applicable login or verification process.</p>
          <p>
            Unsubscribing from marketing does not automatically terminate a paid membership. You may still receive
            necessary messages about your membership. You can unsubscribe from marketing under Personal Information
            in the app.
          </p>
        </Section>

        <Section title="5. Cookies and similar technologies">
          <p>
            The membership portal uses or may use cookies and similar technologies for login, security and necessary
            settings. Optional analytics and advertising technologies are activated only after consent where required.
          </p>
          <p>
            Our separate <Link href="/cookie-policy" className="text-cashmere-accent hover:underline">Cookie Policy</Link> explains
            the technologies used, their providers, purposes and durations, and how you can manage your choices.
          </p>
          <p>You can reject optional technologies and withdraw consent through the cookie settings. Blocking necessary cookies may affect login and other features.</p>
        </Section>

        <Section title="6. Sharing personal data">
          <p>We may share necessary personal data with providers that assist us with:</p>
          <List
            items={[
              "Operating and hosting the membership portal.",
              "Customer accounts, online commerce and membership payments.",
              "Email, newsletters and customer communications.",
              "Delivery of membership gifts.",
              "Technical support and security.",
              "Analytics and advertising where the necessary consent has been obtained.",
            ]}
          />
          <p>Providers acting as processors process data under our instructions and in accordance with data processing agreements.</p>
          <p>Some providers may act as independent controllers for parts of their services. In those cases, their privacy information also applies.</p>
          <p>Access for staff and partners is limited to what they need for their duties.</p>
          <p>Producers and designers do not gain access to the membership register simply because they collaborate with Cashmere Lovers Club.</p>
          <p>We may also share data where required by law or necessary to establish, exercise or defend legal claims.</p>
        </Section>

        <Section title="7. Transfers outside the EEA">
          <p>
            If personal data is transferred or made accessible to recipients outside the European Economic Area
            (EEA), we ensure that a valid transfer mechanism is in place.
          </p>
          <p>
            This may be a European Commission adequacy decision or the EU Standard Contractual Clauses, together with
            any necessary supplementary measures.
          </p>
          <p>Access by staff or partners in countries outside the EEA is also assessed under these rules.</p>
          <p>You can contact us for information about relevant transfers and to obtain a copy of the relevant safeguards.</p>
        </Section>

        <Section title="8. How long we retain personal data">
          <p>We retain personal data for as long as necessary for the purpose for which it was collected.</p>
          <List
            items={[
              "Membership profile: While the membership or account remains active, and subsequently for a limited period where continued retention is necessary.",
              "Payment and accounting records: For as long as required by applicable law.",
              "Enquiries: Until the matter and necessary follow-up have been completed.",
              "Favourites and votes: For as long as necessary for the relevant feature or activity. Results may be retained in anonymised form.",
              "Security logs: For a limited period necessary for security and troubleshooting.",
              "Marketing data: Until consent is withdrawn or the data is no longer needed.",
              "Records of consent and opt-outs: For as long as necessary to document and respect your choices.",
            ]}
          />
          <p>Personal data is retained for up to one year, or in accordance with applicable law in the EU and EEA.</p>
          <p>
            When an account is deleted, certain information may be retained to comply with legal obligations or
            handle legal claims. Backups are deleted or overwritten in accordance with our established procedures.
          </p>
        </Section>

        <Section title="9. Information security">
          <p>
            We use appropriate technical and organisational measures to protect personal data against unauthorised
            access, alteration, disclosure and loss.
          </p>
          <p>Access is limited to authorised individuals who need the information for their work.</p>
          <p>No method of transmission over the internet or electronic storage can be guaranteed to be completely secure.</p>
        </Section>

        <Section title="10. Your rights">
          <p>Subject to the conditions of applicable data protection law, you may have the right to:</p>
          <List
            items={[
              "Access your personal data.",
              "Have inaccurate or incomplete information corrected.",
              "Request erasure.",
              "Request restriction of processing.",
              "Object to processing based on legitimate interests.",
              "Receive certain data in a structured, commonly used and machine-readable format.",
              "Withdraw consent.",
            ]}
          />
          <p>You can object at any time to the use of your personal data for direct marketing.</p>
          <p>Withdrawing consent does not affect the lawfulness of processing carried out before consent was withdrawn.</p>
          <p>
            You can contact us at{" "}
            <a href="mailto:privacy@cashmerehouse.no" className="text-cashmere-accent hover:underline">
              privacy@cashmerehouse.no
            </a>{" "}
            or use the privacy features in your membership profile where available.
          </p>
          <p>
            We may request information necessary to verify your identity. We normally respond within one month. If a
            permitted extension is necessary, we will inform you of the extension and the reasons within the first
            month.
          </p>
          <p>
            You have the right to complain to the Data Protection Commission in Ireland at{" "}
            <a href="https://dataprotection.ie" className="text-cashmere-accent hover:underline" target="_blank" rel="noopener noreferrer">
              dataprotection.ie
            </a>
            , or to the relevant supervisory authority where you live or work. Users in Norway may contact
            Datatilsynet at{" "}
            <a href="https://datatilsynet.no" className="text-cashmere-accent hover:underline" target="_blank" rel="noopener noreferrer">
              datatilsynet.no
            </a>
            .
          </p>
        </Section>

        <Section title="11. Automated decisions and profiling">
          <p>
            We do not use your personal data for decisions based solely on automated processing that produce legal
            effects or similarly significantly affect you.
          </p>
          <p>
            Automatic updates to membership status following payment are used to administer membership. If you
            believe your status is incorrect, you can contact us for review.
          </p>
        </Section>

        <Section title="12. Children's privacy">
          <p>You must be at least 18 years old to become a member of Cashmere Lovers Club.</p>
          <p>
            If you believe a child has registered or provided us with personal data contrary to the applicable age
            requirements, please contact us. We will investigate and take any necessary action.
          </p>
        </Section>

        <Section title="13. External links">
          <p>The membership portal may contain links to online stores, producers, designers and other websites.</p>
          <p>These websites have their own privacy policies. We recommend reading them before providing personal data.</p>
        </Section>

        <Section title="14. Changes to this policy">
          <p>We may update this Privacy Policy following changes to the membership portal, our services or applicable legal requirements.</p>
          <p>The current version is published with an updated date. For material changes, we provide additional information and obtain fresh consent where necessary.</p>
        </Section>

        <Section title="15. Contact us">
          <p>If you have questions about this Privacy Policy or wish to exercise your rights, you can contact:</p>
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

function LegalBasisItem({ title, body, basis }: { title: string; body: string; basis: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium text-cashmere-text">{title}</h3>
      <p>{body}</p>
      <p className="text-sm text-cashmere-text-muted">
        <span className="font-medium">Legal basis:</span> {basis}
      </p>
    </div>
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
