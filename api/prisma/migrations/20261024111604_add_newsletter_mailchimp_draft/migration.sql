-- AlterTable
ALTER TABLE "NewsletterCampaign" ADD COLUMN     "mailchimpCampaignId" TEXT,
ADD COLUMN     "mailchimpSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mailchimpWebId" INTEGER;
