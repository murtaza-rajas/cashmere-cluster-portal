-- CreateEnum
CREATE TYPE "MongoliaPhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MongoliaPhoto" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "status" "MongoliaPhotoStatus" NOT NULL DEFAULT 'PENDING',
    "foundingOnly" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MongoliaPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MongoliaPhoto_status_idx" ON "MongoliaPhoto"("status");

-- AddForeignKey
ALTER TABLE "MongoliaPhoto" ADD CONSTRAINT "MongoliaPhoto_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MongoliaPhoto" ADD CONSTRAINT "MongoliaPhoto_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
