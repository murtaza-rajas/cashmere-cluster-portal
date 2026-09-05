-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "variantTitle" TEXT,
    "price" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_memberId_idx" ON "WishlistItem"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_memberId_shopifyProductId_key" ON "WishlistItem"("memberId", "shopifyProductId");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
