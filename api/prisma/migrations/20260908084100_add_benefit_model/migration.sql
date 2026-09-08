-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('BENEFIT', 'OFFER');

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL,
    "type" "BenefitType" NOT NULL,
    "tiers" "MembershipTier"[],
    "icon" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Benefit_type_idx" ON "Benefit"("type");

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
