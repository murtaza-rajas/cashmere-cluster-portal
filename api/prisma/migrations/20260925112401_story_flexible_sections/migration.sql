/*
  Warnings:

  - You are about to drop the column `active` on the `Story` table. All the data in the column will be lost.
  - You are about to drop the column `body` on the `Story` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Story` table. All the data in the column will be lost.
  - You are about to drop the column `quote` on the `Story` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StorySectionType" AS ENUM ('TEXT', 'IMAGE', 'IMAGE_GALLERY', 'QUOTE');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- DropIndex
DROP INDEX "Story_active_idx";

-- AlterTable
ALTER TABLE "Story" DROP COLUMN "active",
DROP COLUMN "body",
DROP COLUMN "category",
DROP COLUMN "quote",
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "StoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySection" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "StorySectionType" NOT NULL,
    "text" TEXT,
    "imageUrl" TEXT,
    "galleryImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quoteText" TEXT,
    "quoteAttribution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoryCategory_name_key" ON "StoryCategory"("name");

-- CreateIndex
CREATE INDEX "StorySection_storyId_idx" ON "StorySection"("storyId");

-- CreateIndex
CREATE INDEX "Story_status_idx" ON "Story"("status");

-- CreateIndex
CREATE INDEX "Story_categoryId_idx" ON "Story"("categoryId");

-- AddForeignKey
ALTER TABLE "StorySection" ADD CONSTRAINT "StorySection_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
