// Mints ready-to-click "preview login" links for the staff dashboards, so someone
// without any technical/network knowledge (e.g. the client) can open a real staff
// dashboard for a given role and see live data — no devtools, curl, or cookie-editing
// needed. Pairs with StaffController#previewLogin (GET /staff/preview-login?token=...),
// which turns the token this prints into a real clc_staff_session cookie and redirects
// straight into /staff.
//
// Same JWT shape as scripts/create-test-staff.ts (signed with STAFF_JWT_SECRET), just
// a longer expiry (a client reviewing over several days, not a single dev test) and
// prints a full clickable URL instead of a bare token.
//
// This is a stopgap for the still-provisional staff login (see staff-jwt.strategy.ts)
// — remove once real staff login (magic link/Auth0/Passkeys) replaces it.
//
// Usage:
//   npx ts-node scripts/create-staff-preview-link.ts <API_BASE_URL> "<Role Name>"
//   npx ts-node scripts/create-staff-preview-link.ts <API_BASE_URL> --all
//
// Example (production):
//   npx ts-node scripts/create-staff-preview-link.ts https://members.cashmerehouse.com --all
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();
const PREVIEW_LINK_EXPIRY = '7d';

const ALL_ROLES = [
  'Super Administrator',
  'Club Manager',
  'Content Manager',
  'Newsletter Manager',
  'Member Support',
  'Commerce Manager',
  'Event Manager',
  'Analytics Viewer',
  'Technical Administrator',
  'Investor Relations Manager',
  'Mongolia Editor',
];

async function linkFor(apiBaseUrl: string, roleName: string): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const email = `preview-${roleName.toLowerCase().replace(/[^a-z]+/g, '-')}@example.com`;

  const staff = await prisma.staffUser.upsert({
    where: { email },
    update: {},
    create: { email, name: `Preview (${roleName})` },
  });

  await prisma.staffRoleAssignment.upsert({
    where: { staffUserId_roleId: { staffUserId: staff.id, roleId: role.id } },
    update: {},
    create: { staffUserId: staff.id, roleId: role.id },
  });

  const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, {
    expiresIn: PREVIEW_LINK_EXPIRY,
  });
  return `${apiBaseUrl.replace(/\/$/, '')}/staff/preview-login?token=${token}`;
}

async function main() {
  const apiBaseUrl = process.argv[2];
  const roleArg = process.argv[3];

  if (!apiBaseUrl || !roleArg) {
    console.error(
      'Usage: npx ts-node scripts/create-staff-preview-link.ts <API_BASE_URL> "<Role Name>"|--all',
    );
    process.exit(1);
  }

  const roles = roleArg === '--all' ? ALL_ROLES : [roleArg];

  for (const roleName of roles) {
    const link = await linkFor(apiBaseUrl, roleName);
    console.log(`${roleName}:\n  ${link}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
