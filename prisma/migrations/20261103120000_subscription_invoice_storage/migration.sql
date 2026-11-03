CREATE TYPE "PaymentProviderType" AS ENUM ('AZAMPAY', 'STRIPE', 'BANK_TRANSFER');
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'VOIDED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

CREATE TABLE "PlatformPaymentProvider" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isSandbox" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "secretKey" TEXT,
    "publicKey" TEXT,
    "accountId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformPaymentProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT,
    "subscriptionId" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "providerRef" TEXT,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerReference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformPaymentProvider_provider_key"
ON "PlatformPaymentProvider"("provider");
CREATE INDEX "SubscriptionInvoice_tenantId_status_createdAt_idx"
ON "SubscriptionInvoice"("tenantId", "status", "createdAt");
CREATE INDEX "SubscriptionPayment_invoiceId_status_createdAt_idx"
ON "SubscriptionPayment"("invoiceId", "status", "createdAt");

ALTER TABLE "SubscriptionInvoice"
ADD CONSTRAINT "SubscriptionInvoice_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice"
ADD CONSTRAINT "SubscriptionInvoice_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "PlatformPaymentProvider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "PlatformPaymentProvider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
