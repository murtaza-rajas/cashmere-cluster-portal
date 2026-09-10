-- CreateTable
CREATE TABLE "MongoliaStory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "category" TEXT,
    "heroImageUrl" TEXT,
    "foundingOnly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MongoliaStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MongoliaStory_active_idx" ON "MongoliaStory"("active");

-- AddForeignKey
ALTER TABLE "MongoliaStory" ADD CONSTRAINT "MongoliaStory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
