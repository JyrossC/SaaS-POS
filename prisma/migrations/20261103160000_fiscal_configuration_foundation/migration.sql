CREATE TYPE "FiscalJurisdiction" AS ENUM ('MAINLAND_TANZANIA', 'ZANZIBAR');
CREATE TYPE "FiscalProviderApprovalStatus" AS ENUM ('UNVERIFIED', 'SANDBOX_VALIDATED', 'AUTHORITY_APPROVED');
CREATE TYPE "FiscalAddonRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'CLOSED');

CREATE TABLE "FiscalProviderConfiguration" (
  "id" TEXT NOT NULL,
  "jurisdiction" "FiscalJurisdiction" NOT NULL,
  "providerName" TEXT NOT NULL,
  "productionEndpoint" TEXT,
  "sandboxEndpoint" TEXT,
  "documentationUrl" TEXT,
  "approvalStatus" "FiscalProviderApprovalStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "approvalEvidenceReference" TEXT,
  "isAvailable" BOOLEAN NOT NULL DEFAULT false,
  "credentialsEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalProviderConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantFiscalProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jurisdiction" "FiscalJurisdiction" NOT NULL,
  "providerConfigurationId" TEXT,
  "legalName" TEXT,
  "taxIdentificationNumber" TEXT,
  "vatRegistrationNumber" TEXT,
  "credentialsEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFiscalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalAddonOffer" (
  "id" TEXT NOT NULL DEFAULT 'fiscalization',
  "isAvailable" BOOLEAN NOT NULL DEFAULT false,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "monthlyPrice" DECIMAL(19,4),
  "annualPrice" DECIMAL(19,4),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalAddonOffer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalAddonOffer_id_singleton" CHECK ("id" = 'fiscalization'),
  CONSTRAINT "FiscalAddonOffer_currency_tzs_only" CHECK ("currency" = 'TZS'),
  CONSTRAINT "FiscalAddonOffer_price_nonnegative" CHECK (
    ("monthlyPrice" IS NULL OR "monthlyPrice" >= 0) AND
    ("annualPrice" IS NULL OR "annualPrice" >= 0)
  ),
  CONSTRAINT "FiscalAddonOffer_available_requires_price" CHECK (
    NOT "isAvailable" OR "monthlyPrice" IS NOT NULL OR "annualPrice" IS NOT NULL
  )
);

CREATE TABLE "TenantFiscalAddonRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jurisdiction" "FiscalJurisdiction" NOT NULL,
  "status" "FiscalAddonRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFiscalAddonRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalProviderConfiguration_jurisdiction_key"
  ON "FiscalProviderConfiguration"("jurisdiction");
CREATE UNIQUE INDEX "TenantFiscalProfile_tenantId_jurisdiction_key"
  ON "TenantFiscalProfile"("tenantId", "jurisdiction");
CREATE INDEX "TenantFiscalProfile_providerConfigurationId_idx"
  ON "TenantFiscalProfile"("providerConfigurationId");
CREATE INDEX "TenantFiscalAddonRequest_status_createdAt_idx"
  ON "TenantFiscalAddonRequest"("status", "createdAt");
CREATE INDEX "TenantFiscalAddonRequest_tenantId_createdAt_idx"
  ON "TenantFiscalAddonRequest"("tenantId", "createdAt");

ALTER TABLE "TenantFiscalProfile"
  ADD CONSTRAINT "TenantFiscalProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantFiscalProfile"
  ADD CONSTRAINT "TenantFiscalProfile_providerConfigurationId_fkey"
  FOREIGN KEY ("providerConfigurationId") REFERENCES "FiscalProviderConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantFiscalAddonRequest"
  ADD CONSTRAINT "TenantFiscalAddonRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "description", "createdAt")
VALUES
  (gen_random_uuid()::text, 'fiscal_settings.view', 'View fiscal integration configuration', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'fiscal_settings.update', 'Manage tenant fiscal integration configuration', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
JOIN "Permission" AS permission ON permission."code" IN (
  'fiscal_settings.view',
  'fiscal_settings.update'
)
WHERE role."name" = 'Tenant Owner'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
