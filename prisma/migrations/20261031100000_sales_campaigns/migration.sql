-- Create Campaign, CampaignProduct, CustomerSegment, CustomerSegmentMembership,
-- CampaignCustomerSegment, CampaignUsage tables for sales campaigns/promotions

-- CampaignType enum
CREATE TYPE "CampaignType" AS ENUM ('PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'BUY_X_GET_Y', 'BUNDLE_PRICING', 'TIERED_SPEND');

-- CampaignMechanism enum
CREATE TYPE "CampaignMechanism" AS ENUM ('PROMO_CODE', 'AUTOMATIC', 'BOTH');

-- CampaignScope enum
CREATE TYPE "CampaignScope" AS ENUM ('TENANT_WIDE');

-- CustomerTargeting enum
CREATE TYPE "CustomerTargeting" AS ENUM ('ALL_CUSTOMERS', 'LOYALTY_MEMBERS', 'FIRST_TIME_BUYERS', 'SEGMENT_BASED');

-- CampaignRecurrence enum
CREATE TYPE "CampaignRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CampaignStackingRule enum
CREATE TYPE "CampaignStackingRule" AS ENUM ('STACKABLE', 'BEST_ONLY', 'EXCLUSIVE');

-- CampaignStatus enum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');

-- SegmentType enum
CREATE TYPE "SegmentType" AS ENUM ('LOYALTY', 'FIRST_TIME', 'VIP', 'INACTIVE', 'CUSTOM');

-- Create Campaign table
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CampaignType" NOT NULL,
    "mechanism" "CampaignMechanism" NOT NULL,
    "promoCode" TEXT,
    "value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "scope" "CampaignScope" NOT NULL DEFAULT 'TENANT_WIDE',
    "customerTargeting" "CustomerTargeting" NOT NULL DEFAULT 'ALL_CUSTOMERS',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "recurrenceType" "CampaignRecurrence",
    "recurrenceInterval" INTEGER,
    "maxUses" INTEGER,
    "maxUsesPerCustomer" INTEGER,
    "maxUsesPerCustomerPerDay" INTEGER,
    "maxUsesPerStore" INTEGER,
    "minOrderAmount" DECIMAL(19,4),
    "minQuantity" INTEGER,
    "allowedPaymentMethods" TEXT[] DEFAULT '{}',
    "stackingRule" "CampaignStackingRule" NOT NULL DEFAULT 'STACKABLE',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");
CREATE INDEX "Campaign_tenantId_startDate_endDate_idx" ON "Campaign"("tenantId", "startDate", "endDate");
CREATE UNIQUE INDEX "Campaign_tenantId_promoCode_key" ON "Campaign"("tenantId", "promoCode");

-- Create CampaignProduct table
CREATE TABLE "CampaignProduct" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "CampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
    CONSTRAINT "CampaignProduct_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "CampaignProduct_campaignId_productId_key" ON "CampaignProduct"("campaignId", "productId");
CREATE INDEX "CampaignProduct_tenantId_idx" ON "CampaignProduct"("tenantId");

-- Create CustomerSegment table
CREATE TABLE "CustomerSegment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SegmentType" NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX "CustomerSegment_tenantId_type_idx" ON "CustomerSegment"("tenantId", "type");

-- Create CustomerSegmentMembership table
CREATE TABLE "CustomerSegmentMembership" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSegmentMembership_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "CustomerSegmentMembership_segmentId_customerId_key" ON "CustomerSegmentMembership"("segmentId", "customerId");
CREATE INDEX "CustomerSegmentMembership_tenantId_customerId_idx" ON "CustomerSegmentMembership"("tenantId", "customerId");

-- Create CampaignCustomerSegment table
CREATE TABLE "CampaignCustomerSegment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "campaignId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "CampaignCustomerSegment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
    CONSTRAINT "CampaignCustomerSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "CampaignCustomerSegment_campaignId_segmentId_key" ON "CampaignCustomerSegment"("campaignId", "segmentId");
CREATE INDEX "CampaignCustomerSegment_tenantId_idx" ON "CampaignCustomerSegment"("tenantId");

-- Create CampaignUsage table
CREATE TABLE "CampaignUsage" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "storeId" TEXT,
    "saleId" TEXT,
    "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignUsage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
    CONSTRAINT "CampaignUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "CampaignUsage_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL
);

CREATE INDEX "CampaignUsage_campaignId_usedAt_idx" ON "CampaignUsage"("campaignId", "usedAt");
CREATE INDEX "CampaignUsage_tenantId_customerId_idx" ON "CampaignUsage"("tenantId", "customerId");
CREATE INDEX "CampaignUsage_tenantId_storeId_idx" ON "CampaignUsage"("tenantId", "storeId");
