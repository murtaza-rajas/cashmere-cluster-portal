-- CreateTable
CREATE TABLE "ExclusiveCollection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "tiers" "MembershipTier"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ExclusiveCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExclusiveCollection_active_idx" ON "ExclusiveCollection"("active");

-- AddForeignKey
ALTER TABLE "ExclusiveCollection" ADD CONSTRAINT "ExclusiveCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
