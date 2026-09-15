-- CreateTable
CREATE TABLE "MembershipLevel" (
    "id" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "displayName" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "periodLabel" TEXT,
    "benefits" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "MembershipLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipLevel_tier_key" ON "MembershipLevel"("tier");

-- AddForeignKey
ALTER TABLE "MembershipLevel" ADD CONSTRAINT "MembershipLevel_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
