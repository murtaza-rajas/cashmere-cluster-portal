-- Replace single price/currency with explicit dual-currency fields
-- (client email 2026-09-15: every price given has come as an EUR/USD pair
-- with identical face value, not a single canonical figure to convert from).
ALTER TABLE "MembershipLevel" ADD COLUMN "priceEur" DECIMAL(10,2);
ALTER TABLE "MembershipLevel" ADD COLUMN "priceUsd" DECIMAL(10,2);
ALTER TABLE "MembershipLevel" DROP COLUMN "price";
ALTER TABLE "MembershipLevel" DROP COLUMN "currency";
