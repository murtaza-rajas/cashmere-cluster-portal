-- AlterTable
ALTER TABLE "ShopifyAdminToken" ALTER COLUMN "refreshToken" DROP NOT NULL,
ALTER COLUMN "accessTokenExpiresAt" DROP NOT NULL,
ALTER COLUMN "refreshTokenExpiresAt" DROP NOT NULL;
