-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

-- CreateEnum
CREATE TYPE "KybDocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "TenantKybDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "encryptionIv" TEXT NOT NULL,
    "encryptionAuthTag" TEXT NOT NULL,
    "retentionExpiresAt" TIMESTAMP(3) NOT NULL,
    "reviewStatus" "KybDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByPlatformAdminId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantKybDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantKybDocument_tenantId_reviewStatus_createdAt_idx" ON "TenantKybDocument"("tenantId", "reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "TenantKybDocument_retentionExpiresAt_idx" ON "TenantKybDocument"("retentionExpiresAt");

-- AddForeignKey
ALTER TABLE "TenantKybDocument" ADD CONSTRAINT "TenantKybDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantKybDocument" ADD CONSTRAINT "TenantKybDocument_reviewedByPlatformAdminId_fkey" FOREIGN KEY ("reviewedByPlatformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
