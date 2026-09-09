-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('CURRENT', 'SELECTED_FOR_PRODUCTION', 'PAST_ROUND');

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "round" TEXT,
    "status" "DesignStatus" NOT NULL DEFAULT 'CURRENT',
    "tags" TEXT[],
    "heroImageUrl" TEXT,
    "swatchImageUrl" TEXT,
    "sketchImageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignFavorite" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVote" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Design_active_idx" ON "Design"("active");

-- CreateIndex
CREATE INDEX "Design_status_idx" ON "Design"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DesignFavorite_designId_memberId_key" ON "DesignFavorite"("designId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignVote_designId_memberId_key" ON "DesignVote"("designId", "memberId");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignFavorite" ADD CONSTRAINT "DesignFavorite_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignFavorite" ADD CONSTRAINT "DesignFavorite_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVote" ADD CONSTRAINT "DesignVote_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVote" ADD CONSTRAINT "DesignVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
