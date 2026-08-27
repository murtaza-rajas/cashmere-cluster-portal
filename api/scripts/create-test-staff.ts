// Dev-only helper to test the RBAC guard chain without a real staff login flow
// (which doesn't exist yet — see staff-auth.service.ts). Creates/reuses a staff
// user, assigns a role, and prints a signed session JWT usable directly as the
// clc_staff_session cookie value. Not part of the app runtime.
//
// Usage: npx ts-node scripts/create-test-staff.ts "<Role Name>" [email]
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const roleName = process.argv[2] ?? 'Club Manager';
  const email = process.argv[3] ?? 'test-staff@example.com';

  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });

  const staff = await prisma.staffUser.upsert({
    where: { email },
    update: {},
    create: { email, name: `Test Staff (${roleName})` },
  });

  await prisma.staffRoleAssignment.upsert({
    where: { staffUserId_roleId: { staffUserId: staff.id, roleId: role.id } },
    update: {},
    create: { staffUserId: staff.id, roleId: role.id },
  });

  const token = jwt.sign({ sub: staff.id }, process.env.STAFF_JWT_SECRET!, { expiresIn: '12h' });
  console.log(`Staff ${staff.email} (${staff.id}) with role "${roleName}"`);
  console.log(`Token: ${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
