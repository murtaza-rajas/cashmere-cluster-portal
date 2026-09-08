// Seeds the 8 fixed staff role presets confirmed with the client, plus Super Administrator.
// These are NOT user-creatable in Phase 1 — a Super Admin assigns these existing roles
// to staff (with a data scope) via the admin UI, but cannot invent new roles. See
// PROJECT_TRACKER.md Section 3 ("fixed roles as configurable presets").

import { PrismaClient, BenefitType, MembershipTier } from '@prisma/client';

const prisma = new PrismaClient();

// The client's own confirmed My Benefits table (PROJECT_TRACKER.md Section 3c),
// previously hardcoded directly in web/app/(member)/benefits/page.tsx — seeded
// here as real rows so that page can read them from the database instead,
// without losing or altering the actual confirmed content. Member Offers has
// no equivalent starting content (it was always just a "coming soon"
// placeholder — see web/app/(member)/member-offers/page.tsx), so it's
// deliberately left empty for staff to populate via the new admin UI.
const BENEFITS: {
  tier: MembershipTier;
  sortOrder: number;
  icon: string;
  title: string;
  description: string;
}[] = [
  { tier: MembershipTier.FOUNDING, sortOrder: 0, icon: 'star', title: 'Term', description: '5-year membership' },
  { tier: MembershipTier.FOUNDING, sortOrder: 1, icon: 'star', title: 'Status', description: 'Founding Member status' },
  { tier: MembershipTier.FOUNDING, sortOrder: 2, icon: 'gift', title: 'Welcome gift', description: 'Cashmere scarf, ~€200 value' },
  { tier: MembershipTier.FOUNDING, sortOrder: 3, icon: 'tag', title: 'Discount', description: '20% until 31 March 2027, then permanent 15%' },
  { tier: MembershipTier.FOUNDING, sortOrder: 4, icon: 'calendar', title: 'Early access', description: 'Selected products/collections' },
  { tier: MembershipTier.FOUNDING, sortOrder: 5, icon: 'sparkles', title: 'Offers', description: 'Exclusive member offers' },
  { tier: MembershipTier.FOUNDING, sortOrder: 6, icon: 'calendar', title: 'Events', description: 'Exclusive member events' },
  { tier: MembershipTier.FOUNDING, sortOrder: 7, icon: 'crown', title: 'Other', description: 'Priority access to future Club benefits' },
  { tier: MembershipTier.ANNUAL, sortOrder: 0, icon: 'star', title: 'Term', description: '1-year membership' },
  { tier: MembershipTier.ANNUAL, sortOrder: 1, icon: 'star', title: 'Status', description: 'Member status' },
  { tier: MembershipTier.ANNUAL, sortOrder: 2, icon: 'gift', title: 'Welcome gift', description: '—' },
  { tier: MembershipTier.ANNUAL, sortOrder: 3, icon: 'tag', title: 'Discount', description: '10%' },
  { tier: MembershipTier.ANNUAL, sortOrder: 4, icon: 'calendar', title: 'Early access', description: 'Selected products/collections' },
  { tier: MembershipTier.ANNUAL, sortOrder: 5, icon: 'sparkles', title: 'Offers', description: 'Standard member offers' },
  { tier: MembershipTier.ANNUAL, sortOrder: 6, icon: 'calendar', title: 'Events', description: 'Selected member events' },
  { tier: MembershipTier.ANNUAL, sortOrder: 7, icon: 'crown', title: 'Other', description: '—' },
];

const ROLES: { name: string; description: string }[] = [
  {
    name: 'Super Administrator',
    description: 'Full system control: modules, roles, permissions, integrations, audit log and system settings.',
  },
  {
    name: 'Club Manager',
    description: 'Membership operation and overall club activity: members, status, benefits, offers, reporting.',
  },
  {
    name: 'Content Manager',
    description: 'Editorial content: stories, news, videos, Care & Repair guides.',
  },
  {
    name: 'Newsletter Manager',
    description: 'Newsletter operation: audiences, campaigns, schedules, statistics.',
  },
  {
    name: 'Member Support',
    description: 'Member service: profiles, inquiries, gifts and practical support cases.',
  },
  {
    name: 'Commerce Manager',
    description: 'Shopify and commercial content: products, collections, discounts, order view.',
  },
  {
    name: 'Event Manager',
    description: 'Events and invitations: creation, audience, registration and attendance.',
  },
  {
    name: 'Analytics Viewer',
    description: 'Read-only insight: reports and dashboards, no changes.',
  },
  {
    name: 'Technical Administrator',
    description: 'Technical operation: integrations, diagnostics and limited settings.',
  },
  {
    name: 'Investor Relations Manager',
    description: 'Investor communication and controlled document access: profiles, updates, reporting.',
  },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`Seeded ${ROLES.length} roles.`);

  // No natural unique key to upsert against (title repeats across tiers, e.g.
  // "Term" for both FOUNDING and ANNUAL) — guarded by an existence check
  // instead, so re-running the seed never duplicates these rows.
  const existingBenefitCount = await prisma.benefit.count({ where: { type: BenefitType.BENEFIT } });
  if (existingBenefitCount === 0) {
    await prisma.benefit.createMany({
      data: BENEFITS.map((b) => ({
        type: BenefitType.BENEFIT,
        tiers: [b.tier],
        icon: b.icon,
        title: b.title,
        description: b.description,
        sortOrder: b.sortOrder,
      })),
    });
    console.log(`Seeded ${BENEFITS.length} benefit rows.`);
  } else {
    console.log('Benefit rows already exist, skipping seed.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
