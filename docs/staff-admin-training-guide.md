# Staff Admin Portal — Training Guide

**Milestone 6 deliverable.** A working guide to every real area of the Cashmere Lovers Club Staff Admin Portal, for whoever is actually going to run it day to day — not a feature list, a "how do I do X" reference. Written straight from the current code (verified 2026-09-22, `app/web/app/staff/**`), not from memory or the original spec — a few things drifted from what was originally planned, and this guide describes what's actually there.

See `PROJECT_TRACKER.md` for project status and what's still being built. This document is about what already exists and how to use it.

## Before anything else: how staff sign in

There is no real staff login screen yet — this is a known, deliberate gap (see `PROJECT_TRACKER.md`, Milestone 1's auth evaluation). Staff accounts and roles are fully real and functional; only the *sign-in* mechanism is a placeholder pending a real identity provider decision. Don't build workflows or send this guide to end users assuming a normal login form exists — check with Rick on the current sign-in mechanism before onboarding anyone new.

Once signed in, what a staff member can see is entirely determined by their **roles** (below) — the sidebar only ever shows the areas a given account actually has access to.

## Roles & permissions

Every staff account can hold one or more of these 11 roles. A role only grants what its description says — there's no partial/custom permission system, and access can't be fine-tuned beyond "has this role or doesn't."

| Role | What it grants |
|---|---|
| **Super Administrator** | Everything, unconditionally — bypasses every other role check in the system. The only role that can create staff accounts or grant/revoke roles. |
| **Club Manager** | Members & Users, Membership Levels, Offers & Benefits |
| **Content Manager** | Site Images, Care & Repair, Design Lab, Stories & Knowledge, Mongolia (content areas) |
| **Newsletter Manager** | Communication |
| **Member Support** | Members & Users, GDPR Requests |
| **Commerce Manager** | Shopify & Orders |
| **Event Manager** | Events & Invitations, Mongolia Events |
| **Analytics Viewer** | Reports & Analytics (read-only by design — the role's own description is "no changes") |
| **Technical Administrator** | Integrations & Settings |
| **Investor Relations Manager** | Seeded and available to grant, but **no admin area is built for it yet** — granting this role today does nothing. Not a bug; just not built. |
| **Mongolia Editor** | The regional counterpart to Club Manager/Content Manager/Event Manager, but confined to Mongolia-only content — see below. |

**Two things worth understanding, not just memorizing:**

- **Super Administrator always wins.** Even a route that lists specific roles (e.g. "Club Manager only") will still let a Super Administrator through. This is a deliberate, system-wide bypass, not a bug to "fix" by also adding Super Administrator to every role list.
- **Mongolia Editor is scoped by region, not by page.** It doesn't unlock new pages — it lets someone manage the *Mongolia-only* rows of the same underlying content (stories, producers, events, offers, members) that Content/Club/Event Manager already manage internationally. A Mongolia Editor with no other role literally cannot see or touch anything outside Mongolia's own data, even though several Mongolia sub-pages share a screen with the international version.

**Managing staff accounts and roles** happens at **Staff & Roles** (Super Administrator only). Creating an account does **not** grant any role — that's always a separate, deliberate second step, so a new hire never accidentally inherits access before someone decides what they should have.

## The admin areas, in sidebar order

### Staff & Roles — *Super Administrator*
Create staff accounts, grant/revoke roles. This is the only place roles are managed anywhere in the system.

### Members & Users — *Club Manager, Member Support*
Search and look up members. Opening a member shows a **read-only** combined view: profile, Shopify orders, their "collection" (owned pieces), and wishlist. There is no edit, no tier change, no delete — members are entirely self-managed via Shopify login. If a member needs a correction to their profile or tier, that's not doable from this screen today; flag it to Rick rather than looking for a hidden edit button.

### Membership Levels — *Club Manager*
One card per tier (Founding, Annual, Newsletter, Mongolia) — edit the display name, EUR/USD price, period label, and benefits summary shown to members. The four tiers themselves are fixed; you can't add or remove one here. Each card has a read-only "Access" panel showing what that tier can reach elsewhere in the app — informational only, not editable from this screen.

### Offers & Benefits — *Club Manager*
Manages both "My Benefits" and "Member Offers" content members see, from one shared list (a tab switches between the two). **Important**: leaving every tier checkbox unchecked doesn't mean "visible to everyone" — it means the row is a draft, visible to nobody. This is the single easiest way to accidentally publish something nobody can see. There's no delete confirmation — clicking the trash icon removes the row immediately.

### Site Images — *Club Manager, Content Manager*
Upload a hero photo per membership tier for three fixed spots (Dashboard hero, Care & Repair hero, sidebar "Need Help?" photo) — 12 independent slots (3 spots × 4 tiers). A tier with nothing uploaded for a slot falls back to the site's bundled default photo automatically; that's expected, not broken.

### Events & Invitations — *Event Manager*
Create/edit/delete events, with an optional photo. Leave the date blank and members see "Date to be announced"; leave the registration link blank and they see "Registration opening soon" — both are honest, intentional placeholders, not bugs. Same "no tiers = invisible draft" rule as Offers & Benefits applies here too.

### Care & Repair — *Content Manager*
Edit the guide text for five fixed topics: Washing & Cleaning, Storage, Pilling, Simple Repairs, Longevity. You can't add a sixth topic here — only fill in the five that exist. An empty topic shows members "Guide coming soon."

### Design Lab — *Content Manager*
Manage the designs Founding Members vote on and Annual Members preview (view/save only, no vote — Newsletter and Mongolia members don't see this area at all). Each design has three separate image slots (hero photo, fabric swatch, sketch) and a status: Current → Selected for Development → Selected for Production → Past Round. This is international-only — Mongolia has no equivalent Design Lab.

### Stories & Knowledge — *Content Manager*
Club news and stories, including Designer Spotlight pieces (set the "designer name" field to attribute a story to a real designer and pull in their Design Lab concepts automatically). Same draft/tier rule as everywhere else.

### Mongolia — *Content Manager or Mongolia Editor*
A self-contained nested section (expand it in the sidebar) mirroring several international areas but scoped strictly to Mongolia:

| Sub-page | Mirrors | Notes |
|---|---|---|
| Dashboard | — | Mongolia-specific stats only |
| Stories & News | Stories & Knowledge | Own separate content, own data — not the same rows as the international page |
| Producers | — | Producer profiles; also what members vote on (see Voting) |
| Your Voice / Voting | — | **Read-only** results view. No poll-builder — votes come from members |
| Current Offers | Offers & Benefits | Own rows — never inherits international offers automatically |
| Mongolia and the World | Stories & News | Not a separate content type — it's Stories & News filtered by category. Full editing (photos, delete) only works from the actual Stories & News page |
| Events | Events & Invitations | Same **Event Manager** role gate as the international page — Content Manager alone doesn't unlock this one; you need Event Manager or Mongolia Editor specifically |
| Membership Access | Members & Users | Same member data, filtered to Mongolia region. Read-only, same as the international page |

Deleting a producer here also removes it from voting results, since voting reads live from the same producer list.

**Photo Archive (`/staff/mongolia/photos`) is deliberately not in this list or the sidebar.** It's fully built (a real Pending/Approved/Rejected moderation queue) but explicitly deferred to **after the 1 November launch** — Morten wants member-submission consent/usage-rights handling designed before it goes live, and the nav link was removed on purpose so a permanently-empty queue doesn't read as live functionality before then. The page still works if you go there directly; don't re-add it to navigation without checking with Rick that it's actually launch-cleared.

### Communication — *Newsletter Manager*
Draft newsletter campaigns — subject, body, intended audience, intended send date, and a Draft/"Ready to send" status. **There is no send button anywhere in this app.** Mailchimp isn't connected yet (see Integrations & Settings), so a "Ready to send" campaign has to be copied out and sent through Mailchimp directly by hand. This is the one area most likely to look unfinished if you don't know that going in — it isn't; it's doing exactly what it was built to do.

### GDPR Requests — *Super Administrator, Member Support*
Queue of pending member data-**access/export** requests only — deletion requests are handled automatically elsewhere and never appear here. Mark a request complete once the export has actually been delivered to the member; an optional note field is there for recording how (e.g. "emailed CSV").

### Audit Log — *Super Administrator*
Read-only record of every sensitive admin action system-wide — who did what, to what, and when. Filterable by action, target type, and date range. There's no way to edit or clear entries from here, by design.

### Reports & Analytics — *Analytics Viewer*
Read-only dashboards: member totals/status, Founding count, tier breakdown, new members by week/month, and sales by currency. Two honest gaps, not bugs: the sales table stays empty until Shopify's order-sync webhook is registered against the live store, and a 5th "member engagement" KPI is shown as "not built yet" — it's waiting on the client to define what "engagement" actually means before it can be built.

### Shopify & Orders — *Commerce Manager*
Read-only, cross-member order table synced from Shopify. Shopify itself stays the source of truth — nothing here is editable. Click a row to expand and see line items. (A member's own order history is also visible from their individual page under Members & Users — this page is the all-members view.)

### Integrations & Settings — *Technical Administrator*
Despite the name, this is a **status page, not a settings page** — nothing here is editable. It shows real, live connection health: Shopify OAuth/webhooks, database, and honest "Not built yet" badges for Mailchimp and Strapi/CMS. This is the page that explains *why* Communication can't send yet — Mailchimp's badge here will flip once that integration exists.

## Patterns worth knowing across every area

- **"No tiers/audience selected" always means invisible draft, never "visible to everyone."** This rule is identical on Offers & Benefits, Events & Invitations, Stories & Knowledge, Mongolia Offers, Mongolia Events, and Communication. It's the single easiest way to accidentally publish nothing — if content isn't showing up for members, check this first.
- **Delete has no confirmation step, anywhere.** Clicking the trash icon on a benefit, event, design, story, Mongolia story/producer, or communication campaign removes it immediately. Pause before clicking.
- **International and Mongolia pairs usually share one backend model, just filtered** — Offers & Benefits ↔ Mongolia Current Offers, Events & Invitations ↔ Mongolia Events, Members & Users ↔ Mongolia Membership Access. Editing one doesn't touch the other's rows, but they're built on the same underlying table, not a duplicate system.
- **Purely read-only areas** (nothing to create/edit/delete): Members & Users' detail view, Mongolia Voting, Mongolia Membership Access, Shopify & Orders, Reports & Analytics, Integrations & Settings, Audit Log.

## Known limitations, stated plainly

- Real staff login doesn't exist yet (see top of this guide).
- Communication can draft but not send — needs Mailchimp API access, not yet granted.
- Collections and Exclusive Collections admin don't exist yet — blocked on Shopify Storefront API credentials.
- Reports & Analytics' 5th KPI (member engagement) is a placeholder pending a client definition of the term.
- Investor Relations Manager role exists but has no admin area built for it.
- Mongolia Photo Archive is built and working but deliberately hidden from navigation until after 1 November launch — see the Mongolia section above.

Anything not listed above that looks unfinished is worth flagging to Rick rather than assumed — this list is meant to be the complete set of known, deliberate gaps as of 2026-09-22, not a reason to stop asking.
