-- AlterTable
ALTER TABLE "Benefit" ADD COLUMN     "regions" "Region"[] DEFAULT ARRAY['INTERNATIONAL', 'MONGOLIA']::"Region"[];

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "regions" "Region"[] DEFAULT ARRAY['INTERNATIONAL', 'MONGOLIA']::"Region"[];
