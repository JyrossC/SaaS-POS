CREATE TYPE "FiscalAddonBillingPeriod" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "FiscalAddonSubscriptionStatus" AS ENUM (
  'PENDING_PAYMENT',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED'
);

ALTER TABLE "FiscalAddonOffer"
  ADD COLUMN "isTestOnly" BOOLEAN NOT NULL DEFAULT true;

UPDATE "FiscalAddonOffer"
SET "isAvailable" = false, "isTestOnly" = true;

INSERT INTO "FiscalAddonOffer" (
  "id",
  "isAvailable",
  "isTestOnly",
  "currency",
  "monthlyPrice",
  "annualPrice",
  "updatedAt"
) VALUES (
  'fiscalization',
  false,
  true,
  'TZS',
  35000,
  400000,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN "fiscalAddonSubscriptionId" TEXT,
  ADD COLUMN "fiscalBillingPeriod" "FiscalAddonBillingPeriod",
  ADD COLUMN "fiscalPeriodStartsAt" TIMESTAMP(3),
  ADD COLUMN "fiscalPeriodEndsAt" TIMESTAMP(3),
  ADD COLUMN "isTestMode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "isTestMode" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FiscalAddonSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jurisdiction" "FiscalJurisdiction" NOT NULL,
  "billingPeriod" "FiscalAddonBillingPeriod" NOT NULL,
  "status" "FiscalAddonSubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "isTestMode" BOOLEAN NOT NULL DEFAULT true,
  "currentPeriodStartsAt" TIMESTAMP(3),
  "currentPeriodEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalAddonSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalAddonSubscription_currency_tzs_only" CHECK ("currency" = 'TZS'),
  CONSTRAINT "FiscalAddonSubscription_amount_nonnegative" CHECK ("amount" >= 0)
);

CREATE UNIQUE INDEX "FiscalAddonSubscription_tenantId_jurisdiction_key"
  ON "FiscalAddonSubscription"("tenantId", "jurisdiction");
CREATE INDEX "FiscalAddonSubscription_status_currentPeriodEndsAt_idx"
  ON "FiscalAddonSubscription"("status", "currentPeriodEndsAt");
CREATE INDEX "FiscalAddonSubscription_tenantId_createdAt_idx"
  ON "FiscalAddonSubscription"("tenantId", "createdAt");
CREATE INDEX "SubscriptionInvoice_fiscalAddonSubscriptionId_createdAt_idx"
  ON "SubscriptionInvoice"("fiscalAddonSubscriptionId", "createdAt");
CREATE UNIQUE INDEX "SubscriptionPayment_invoiceId_providerReference_key"
  ON "SubscriptionPayment"("invoiceId", "providerReference");

ALTER TABLE "FiscalAddonSubscription"
  ADD CONSTRAINT "FiscalAddonSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice"
  ADD CONSTRAINT "SubscriptionInvoice_fiscalAddonSubscriptionId_fkey"
  FOREIGN KEY ("fiscalAddonSubscriptionId") REFERENCES "FiscalAddonSubscription"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
