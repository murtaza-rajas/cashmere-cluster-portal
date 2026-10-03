// Mints a ready-to-click "preview login" link for a demo MEMBER account — e.g. the
// Mongolia demo account (client request, 2026-10-03) so collaborators can see the
// Mongolian member portal without a real Shopify login. Pairs with
// SessionController#previewLogin (GET /auth/preview-login?token=...).
//
// Deliberately short-lived (72h, not the normal 30-day member session) since the
// link itself grants access — see session.controller.ts's own comment. Re-run this
// to mint a fresh link once one expires.
//
// The member row uses a fake shopifyCustomerId (same `demo-<email>` convention as
// create-test-member.ts) — this is explicitly NOT a real Shopify customer, just a
// CLC-side demo record, same as every other test/demo account this project has used.
//
// Usage:
//   npx ts-node scripts/create-member-preview-link.ts <API_BASE_URL> <email> <tier> [region] [isFoundingMember]
//
// Example (Mongolia demo, full access):
//   npx ts-node scripts/create-member-preview-link.ts https://members.cashmerehouse.com mongolia-demo@example.com MONGOLIA MONGOLIA true
import { PrismaClient, MembershipTier, Region } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();
const PREVIEW_LINK_EXPIRY = '72h';

async function main() {
  const apiBaseUrl = process.argv[2];
  const email = process.argv[3];
  const tier = process.argv[4] as MembershipTier | undefined;
  const region = (process.argv[5] as Region | undefined) ?? Region.INTERNATIONAL;
  const isFoundingMember = process.argv[6] === 'true';

  if (!apiBaseUrl || !email || !tier) {
    console.error(
      'Usage: npx ts-node scripts/create-member-preview-link.ts <API_BASE_URL> <email> <FOUNDING|ANNUAL|MONGOLIA|NEWSLETTER> [INTERNATIONAL|MONGOLIA] [isFoundingMember true|false]',
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

  const token = jwt.sign({ sub: member.id }, process.env.JWT_SECRET!, {
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
