-- CreateEnum
CREATE TYPE "CareGuideTopic" AS ENUM ('WASHING', 'STORAGE', 'PILLING', 'REPAIRS', 'LONGEVITY');

-- CreateTable
CREATE TABLE "CareGuide" (
    "id" TEXT NOT NULL,
    "topic" "CareGuideTopic" NOT NULL,
    "body" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CareGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareGuide_topic_key" ON "CareGuide"("topic");

-- AddForeignKey
ALTER TABLE "CareGuide" ADD CONSTRAINT "CareGuide_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
