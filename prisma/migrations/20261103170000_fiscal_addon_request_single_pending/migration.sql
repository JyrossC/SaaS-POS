-- Prisma schema indexes cannot express a partial uniqueness predicate.
CREATE UNIQUE INDEX "TenantFiscalAddonRequest_one_pending_per_jurisdiction_key"
  ON "TenantFiscalAddonRequest"("tenantId", "jurisdiction")
  WHERE "status" = 'PENDING';
