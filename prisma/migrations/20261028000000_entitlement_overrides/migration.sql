-- CreateTable
CREATE TABLE "TenantEntitlementOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT,
    "createdByPlatformAdminId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantEntitlementOverride_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TenantEntitlementOverride" ADD CONSTRAINT "TenantEntitlementOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "TenantEntitlementOverride_tenantId_key_key" ON "TenantEntitlementOverride"("tenantId", "key");
CREATE INDEX "TenantEntitlementOverride_tenantId_idx" ON "TenantEntitlementOverride"("tenantId");
