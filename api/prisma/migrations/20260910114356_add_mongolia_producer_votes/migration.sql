-- CreateTable
CREATE TABLE "MongoliaProducerVote" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MongoliaProducerVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MongoliaProducerVote_producerId_memberId_key" ON "MongoliaProducerVote"("producerId", "memberId");

-- AddForeignKey
ALTER TABLE "MongoliaProducerVote" ADD CONSTRAINT "MongoliaProducerVote_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "MongoliaProducer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MongoliaProducerVote" ADD CONSTRAINT "MongoliaProducerVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
