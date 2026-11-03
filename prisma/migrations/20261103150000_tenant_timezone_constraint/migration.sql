ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_timezone_tz_only"
  CHECK ("timezone" = 'Africa/Dar_es_Salaam');
