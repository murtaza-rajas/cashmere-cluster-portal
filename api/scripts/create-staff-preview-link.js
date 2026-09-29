// Plain Node.js version of create-staff-preview-link.ts, for running directly inside
// the production container — the production image deliberately has no ts-node/
// typescript/dotenv (multi-stage build strips dev deps), so the .ts version can't run
// there. Same logic, no types, reads env vars straight from the process (docker-compose
// already injects them, no .env file to parse). Keep both in sync if this ever changes.
//
// Usage (inside the api container):
//   node scripts/create-staff-preview-link.js <API_BASE_URL> "<Role Name>"|--all
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

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

async function linkFor(apiBaseUrl, roleName) {
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

  const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET, {
    expiresIn: PREVIEW_LINK_EXPIRY,
  });
  return `${apiBaseUrl.replace(/\/$/, '')}/staff/preview-login?token=${token}`;
}

async function main() {
  const apiBaseUrl = process.argv[2];
  const roleArg = process.argv[3];

  if (!apiBaseUrl || !roleArg) {
    console.error(
      'Usage: node scripts/create-staff-preview-link.js <API_BASE_URL> "<Role Name>"|--all',
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
