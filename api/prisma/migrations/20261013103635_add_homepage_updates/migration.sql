-- CreateTable
CREATE TABLE "HomepageUpdate" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'CLC Update',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "displayDate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "storyId" TEXT,
    "tiers" "MembershipTier"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "HomepageUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomepageUpdate_active_idx" ON "HomepageUpdate"("active");

-- AddForeignKey
ALTER TABLE "HomepageUpdate" ADD CONSTRAINT "HomepageUpdate_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageUpdate" ADD CONSTRAINT "HomepageUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
