// Seeds the 8 fixed staff role presets confirmed with the client, plus Super Administrator.
// These are NOT user-creatable in Phase 1 — a Super Admin assigns these existing roles
// to staff (with a data scope) via the admin UI, but cannot invent new roles. See
// PROJECT_TRACKER.md Section 3 ("fixed roles as configurable presets").

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
