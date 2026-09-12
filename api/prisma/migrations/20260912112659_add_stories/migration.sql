-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "body" TEXT,
    "quote" TEXT,
    "category" TEXT,
    "tiers" "MembershipTier"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_active_idx" ON "Story"("active");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
