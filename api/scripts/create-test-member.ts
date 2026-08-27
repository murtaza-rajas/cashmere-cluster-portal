// Dev-only helper to test the member session end-to-end without a real Shopify
// login (which can't be completed until real Shopify credentials + a public HTTPS
// redirect URI exist — see PROJECT_TRACKER.md Section 11). Creates/reuses a member
// and prints a signed session JWT usable directly as the clc_session cookie.
// Not part of the app runtime.
import { PrismaClient, MembershipTier } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? 'test-member@example.com';

  const member = await prisma.member.upsert({
    where: { shopifyCustomerId: `test-${email}` },
    update: {},
    create: {
      shopifyCustomerId: `test-${email}`,
      email,
      firstName: 'Isabella',
      lastName: 'Test',
      membershipTier: MembershipTier.FOUNDING,
      isFoundingMember: true,
    },
  });

  const token = jwt.sign({ sub: member.id }, process.env.JWT_SECRET!, { expiresIn: '30d' });
  console.log(`Member ${member.email} (${member.id}), tier ${member.membershipTier}`);
  console.log(`Token: ${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
