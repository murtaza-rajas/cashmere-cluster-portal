-- DropIndex
DROP INDEX "EmailLoginCode_email_createdAt_idx";

-- AlterTable
ALTER TABLE "EmailLoginCode" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'member';

-- CreateIndex
CREATE INDEX "EmailLoginCode_purpose_email_createdAt_idx" ON "EmailLoginCode"("purpose", "email", "createdAt");
