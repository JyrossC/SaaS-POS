-- Add idempotencyKey to Sale for safe retry semantics
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" TEXT;

-- Unique constraint on tenant-scoped idempotency key to prevent duplicate sales
CREATE UNIQUE INDEX "Sale_tenantId_idempotencyKey_key" ON "Sale"("tenantId", "idempotencyKey");

-- Track refunded quantity per sale item to prevent over-refunding
ALTER TABLE "SaleItem" ADD COLUMN "quantityRefunded" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- Index for efficient refund lookups by sale item
CREATE INDEX "SaleItem_tenantId_saleId_quantityRefunded_idx" ON "SaleItem"("tenantId", "saleId", "quantityRefunded");
