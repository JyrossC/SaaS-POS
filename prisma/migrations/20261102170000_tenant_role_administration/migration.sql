INSERT INTO "Permission" ("id", "code", "description", "createdAt")
VALUES
  (gen_random_uuid()::text, 'roles.view', 'View tenant roles', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'roles.create', 'Create tenant roles', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'roles.update', 'Update tenant roles', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'roles.assign_permissions', 'Assign permissions to tenant roles', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'staff.view', 'View tenant staff', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
JOIN "Permission" AS permission ON permission."code" IN (
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.assign_permissions',
  'staff.view'
)
WHERE EXISTS (
  SELECT 1
  FROM "TenantModuleSetting" AS module_setting
  WHERE module_setting."tenantId" = role."tenantId"
    AND module_setting."moduleKey" = 'staff'
    AND module_setting."enabled" = true
)
  AND role."name" = 'Tenant Owner'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
