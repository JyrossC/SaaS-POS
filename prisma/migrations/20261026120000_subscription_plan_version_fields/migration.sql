-- AlterTable
ALTER TABLE "SubscriptionPlanVersion" ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlanVersion" ADD COLUMN "billingPeriodDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "SubscriptionPlanVersion" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "SubscriptionPlanVersion" ADD COLUMN "price" DECIMAL(19,4);
