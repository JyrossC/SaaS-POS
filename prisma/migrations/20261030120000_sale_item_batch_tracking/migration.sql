-- Add batchId to SaleItem for pharmacy batch tracking on sales

-- Add the batchId column (optional)
ALTER TABLE "SaleItem" ADD COLUMN "batchId" TEXT;

-- Add foreign key to ProductBatch using composite tenant key
ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_batchId_tenantId_fkey"
FOREIGN KEY ("tenantId", "batchId")
REFERENCES "ProductBatch"("tenantId", "id")
ON DELETE RESTRICT;

-- Add index for batch lookups
CREATE INDEX "SaleItem_tenantId_batchId_idx" ON "SaleItem"("tenantId", "batchId");
