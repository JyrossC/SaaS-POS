ALTER TABLE "SubscriptionPlan"
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PlatformAdminInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByPlatformAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAdminInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSupportAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByPlatformAdminId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSupportAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSupportAccessEvent" (
    "id" TEXT NOT NULL,
    "supportAccessId" TEXT NOT NULL,
    "actorPlatformAdminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSupportAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdminInvitation_tokenHash_key"
ON "PlatformAdminInvitation"("tokenHash");
CREATE INDEX "PlatformAdminInvitation_email_acceptedAt_revokedAt_idx"
ON "PlatformAdminInvitation"("email", "acceptedAt", "revokedAt");
CREATE INDEX "PlatformAdminInvitation_expiresAt_idx"
ON "PlatformAdminInvitation"("expiresAt");
CREATE INDEX "PlatformSupportAccess_tenantId_createdAt_idx"
ON "PlatformSupportAccess"("tenantId", "createdAt");
CREATE INDEX "PlatformSupportAccess_createdByPlatformAdminId_expiresAt_revokedAt_idx"
ON "PlatformSupportAccess"("createdByPlatformAdminId", "expiresAt", "revokedAt");
CREATE INDEX "PlatformSupportAccessEvent_supportAccessId_createdAt_idx"
ON "PlatformSupportAccessEvent"("supportAccessId", "createdAt");
CREATE INDEX "PlatformSupportAccessEvent_actorPlatformAdminId_createdAt_idx"
ON "PlatformSupportAccessEvent"("actorPlatformAdminId", "createdAt");

ALTER TABLE "PlatformAdminInvitation"
ADD CONSTRAINT "PlatformAdminInvitation_createdByPlatformAdminId_fkey"
FOREIGN KEY ("createdByPlatformAdminId") REFERENCES "PlatformAdmin"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlatformSupportAccess"
ADD CONSTRAINT "PlatformSupportAccess_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformSupportAccess"
ADD CONSTRAINT "PlatformSupportAccess_createdByPlatformAdminId_fkey"
FOREIGN KEY ("createdByPlatformAdminId") REFERENCES "PlatformAdmin"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE FUNCTION reject_immutable_audit_mutation() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable';
END;
$$;

CREATE TRIGGER "PlatformSupportAccessEvent_immutable"
BEFORE UPDATE OR DELETE ON "PlatformSupportAccessEvent"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_audit_mutation();
