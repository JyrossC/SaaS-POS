# Incident Response Runbook

## Overview

This runbook defines procedures for deploying, monitoring, restoring, investigating, and safely rolling back the SaaS POS platform release.

## 1. Deployment

### Pre-deployment checklist
- [ ] All CI checks pass (lint, typecheck, tests)
- [ ] Database migration reviewed and tested against a production-like database
- [ ] Environment variables validated (JWT_SECRET, INSTALLATION_SECRET, DATABASE_URL, CORS_ORIGINS)
- [ ] Backup of production database taken
- [ ] Rollback plan tested in staging

### Deploy steps
1. Run `npm run migrate:deploy` to apply Prisma migrations
2. Deploy the API release artifact with production environment variables to the selected hosting platform
3. Deploy the web release artifact to the selected hosting platform
4. Verify health endpoint: `GET /health` returns `{"status": "ok"}`
5. Smoke test: login, create sale, view dashboard

### Rollback
1. Redeploy the previous API release artifact
2. Redeploy the previous web release artifact
3. Database migrations are forward-only; do not roll back migrations manually
4. Verify health endpoint and smoke tests

## 2. Monitoring

### Health checks
- `GET /health` - API liveness and database connectivity
- Hosting-platform health checks for the API, web application, and database

### Logs
- All API logs are structured JSON via `LoggingService`
- Error-level logs include stack traces (development only)
- Production logs sanitize error messages (no stack traces)

### Alerts
- API health check failing for > 2 minutes
- Database connectivity lost
- Error rate > 5% over 5 minutes
- Failed jobs > 10 in queue

## 3. Backup and Restore

### Database backup
```bash
pg_dump "$DATABASE_URL" --format=custom --file="backup_$(date +%F).dump"
```

### Database restore
```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" "backup_$(date +%F).dump"
```

Run restore only against the explicitly verified recovery target, never the active production database.

### Backup schedule
- Daily automated backup at 02:00 UTC
- Retain for 30 days
- Test restore monthly

## 4. Incident Response

### P1: Complete outage (API unreachable)
1. Check application and database status in the selected hosting platform's service dashboard
2. Review API logs in the configured log aggregation service
3. Check database connectivity with `pg_isready -d "$DATABASE_URL"`
4. If the database or API is unavailable, follow the hosting provider's recovery procedure
5. If the outage persists, redeploy the previous release artifacts

### P2: Data integrity issue (corrupt inventory, wrong sales)
1. Take immediate database backup
2. Identify affected records via audit logs (`AuditLog` table)
3. Correct data via direct SQL or scripted fix
4. Log all corrective actions in `AuditLog`
5. Notify affected tenants

### P3: Security incident (unauthorized access, data exposure)
1. Revoke all tokens for affected users via `RevokedToken` table
2. Disable affected tenant if necessary (`tenant.status = 'SUSPENDED'`)
3. Review audit logs for unauthorized actions
4. Rotate `JWT_SECRET` if signing key may be compromised
5. Force password reset for affected accounts

## 5. Token Revocation

Revoked tokens are stored in the `RevokedToken` table with an expiry. To revoke all tokens for a user:

```sql
INSERT INTO "RevokedToken" ("id", "tokenHash", "userId", "expiresAt", "createdAt")
SELECT gen_random_uuid(), 'hash-of-token', 'user-id', NOW() + INTERVAL '24 hours', NOW()
FROM "User" WHERE id = 'user-id';
```

## 6. Support and Pilot Procedures

### Pilot onboarding
1. Provision tenant via `POST /auth/register` or platform admin
2. Configure payment provider via `PUT /platform/payment-providers/:provider`
3. Train pilot users on supported workflows (sales, purchasing, pharmacy, returns)
4. Define rollback and data correction procedures before onboarding

### Data correction
1. Never modify production data directly without a backup
2. All corrections must be audited via `AuditLog`
3. Test corrections against a staging database first
4. Document the correction in the incident ticket

## 7. Contact Escalation

- Level 1: On-call engineer
- Level 2: Backend team lead
- Level 3: CTO / infrastructure lead
