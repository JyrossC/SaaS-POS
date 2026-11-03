ALTER TABLE "Tenant"
  ADD COLUMN "businessAddress" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TZS',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  ADD COLUMN "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "Tenant_currency_tzs_only" CHECK ("currency" = 'TZS'),
  ADD CONSTRAINT "Tenant_tax_disabled_pending_review" CHECK ("taxEnabled" = false);

INSERT INTO "Permission" ("id", "code", "description", "createdAt")
VALUES
  (gen_random_uuid()::text, 'business_settings.view', 'View tenant business settings', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'business_settings.update', 'Update tenant business profile settings', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
JOIN "Permission" AS permission ON permission."code" IN (
  'business_settings.view',
  'business_settings.update'
)
WHERE role."name" = 'Tenant Owner'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
