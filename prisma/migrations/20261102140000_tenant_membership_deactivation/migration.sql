INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
JOIN "Permission" AS permission ON permission."code" = 'staff.deactivate'
WHERE role."name" = 'Tenant Owner'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
