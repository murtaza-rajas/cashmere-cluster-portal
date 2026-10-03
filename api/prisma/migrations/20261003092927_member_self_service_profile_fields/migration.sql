-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "countryOfResidence" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "phoneNumber" TEXT;
