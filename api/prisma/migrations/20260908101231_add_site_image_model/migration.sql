-- CreateEnum
CREATE TYPE "SiteImageSlot" AS ENUM ('DASHBOARD_HERO', 'CARE_REPAIR_HERO');

-- CreateTable
CREATE TABLE "SiteImage" (
    "id" TEXT NOT NULL,
    "slot" "SiteImageSlot" NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "SiteImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteImage_slot_tier_key" ON "SiteImage"("slot", "tier");

-- AddForeignKey
ALTER TABLE "SiteImage" ADD CONSTRAINT "SiteImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
