-- CreateEnum
CREATE TYPE "Region" AS ENUM ('INTERNATIONAL', 'MONGOLIA');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'MONGOLIAN');

-- AlterEnum
ALTER TYPE "MembershipTier" ADD VALUE 'MONGOLIA';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'ENGLISH',
ADD COLUMN     "region" "Region" NOT NULL DEFAULT 'INTERNATIONAL';

-- CreateIndex
CREATE INDEX "Member_region_idx" ON "Member"("region");
