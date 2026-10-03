// Plain Node.js version of create-member-preview-link.ts, for running directly inside
// the production container — see create-staff-preview-link.js's own comment for why
// (no ts-node/typescript/dotenv in the production image).
//
// Usage (inside the api container):
//   node scripts/create-member-preview-link.js <API_BASE_URL> <email> <tier> [region] [isFoundingMember]
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const PREVIEW_LINK_EXPIRY = '72h';

async function main() {
  const apiBaseUrl = process.argv[2];
  const email = process.argv[3];
  const tier = process.argv[4];
  const region = process.argv[5] ?? 'INTERNATIONAL';
  const isFoundingMember = process.argv[6] === 'true';

  if (!apiBaseUrl || !email || !tier) {
    console.error(
      'Usage: node scripts/create-member-preview-link.js <API_BASE_URL> <email> <FOUNDING|ANNUAL|MONGOLIA|NEWSLETTER> [INTERNATIONAL|MONGOLIA] [isFoundingMember true|false]',
    );
    process.exit(1);
  }

  const member = await prisma.member.upsert({
    where: { shopifyCustomerId: `demo-${email}` },
    update: { membershipTier: tier, region, isFoundingMember },
    create: {
      shopifyCustomerId: `demo-${email}`,
      email,
      firstName: 'Demo',
      lastName: 'Account',
      membershipTier: tier,
      region,
      isFoundingMember,
    },
  });

  const token = jwt.sign({ sub: member.id }, process.env.JWT_SECRET, {
    expiresIn: PREVIEW_LINK_EXPIRY,
  });
  console.log(`Demo member ${member.email} (tier ${member.membershipTier}, region ${member.region}):`);
  console.log(`  ${apiBaseUrl.replace(/\/$/, '')}/auth/preview-login?token=${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
