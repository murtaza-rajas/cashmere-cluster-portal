/*
  Warnings:

  - You are about to drop the column `termLengthYears` on the `Member` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "MembershipTier" ADD VALUE 'SIX_MONTH';

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "termLengthYears",
ADD COLUMN     "termLengthMonths" INTEGER;
