-- AlterTable
ALTER TABLE "MembershipLevel" ADD COLUMN "shopifyProductId" TEXT,
ADD COLUMN "termLengthMonths" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "MembershipLevel_shopifyProductId_key" ON "MembershipLevel"("shopifyProductId");
