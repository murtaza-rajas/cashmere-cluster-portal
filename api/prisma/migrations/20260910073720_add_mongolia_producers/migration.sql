-- CreateTable
CREATE TABLE "MongoliaProducer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "craft" TEXT,
    "location" TEXT,
    "story" TEXT,
    "heroImageUrl" TEXT,
    "foundingOnly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MongoliaProducer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MongoliaProducer_active_idx" ON "MongoliaProducer"("active");

-- AddForeignKey
ALTER TABLE "MongoliaProducer" ADD CONSTRAINT "MongoliaProducer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
