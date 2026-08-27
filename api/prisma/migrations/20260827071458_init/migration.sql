-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('FOUNDING', 'ANNUAL', 'NEWSLETTER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'EXPORT', 'DELETION');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "membershipTier" "MembershipTier" NOT NULL,
    "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "isFoundingMember" BOOLEAN NOT NULL DEFAULT false,
    "termLengthYears" INTEGER,
    "membershipStartDate" TIMESTAMP(3),
    "membershipEndDate" TIMESTAMP(3),
    "originatingShopifyOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberOrderCache" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberOrderCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authProviderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRoleAssignment" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "dataScope" JSONB NOT NULL DEFAULT '{"scope": "all"}',
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorStaffUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetMemberId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'PENDING',
    "sourceShopifyWebhookId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_shopifyCustomerId_key" ON "Member"("shopifyCustomerId");

-- CreateIndex
CREATE INDEX "Member_membershipTier_idx" ON "Member"("membershipTier");

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOrderCache_shopifyOrderId_key" ON "MemberOrderCache"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "MemberOrderCache_memberId_idx" ON "MemberOrderCache"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_authProviderId_key" ON "StaffUser"("authProviderId");

-- CreateIndex
CREATE INDEX "StaffUser_email_idx" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRoleAssignment_staffUserId_roleId_key" ON "StaffRoleAssignment"("staffUserId", "roleId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_memberId_idx" ON "DataSubjectRequest"("memberId");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_status_idx" ON "DataSubjectRequest"("status");

-- AddForeignKey
ALTER TABLE "MemberOrderCache" ADD CONSTRAINT "MemberOrderCache_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRoleAssignment" ADD CONSTRAINT "StaffRoleAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRoleAssignment" ADD CONSTRAINT "StaffRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRoleAssignment" ADD CONSTRAINT "StaffRoleAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
