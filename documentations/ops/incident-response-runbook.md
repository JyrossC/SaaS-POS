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
2. Deploy API container with production environment variables
3. Deploy web container
4. Verify health endpoint: `GET /health` returns `{"status": "ok"}`
5. Smoke test: login, create sale, view dashboard

### Rollback
1. Revert API container to previous image tag
2. Revert web container to previous image tag
3. Database migrations are forward-only; do not roll back migrations manually
4. Verify health endpoint and smoke tests

## 2. Monitoring

### Health checks
- `GET /health` - API liveness and database connectivity
- Docker healthchecks on postgres, redis, api, web containers

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
docker exec saas-pos-postgres pg_dump -U postgres saas_pos > backup_$(date +%F).sql
```

### Database restore
```bash
docker exec -i saas-pos-postgres psql -U postgres -d saas_pos < backup_$(date +%F).sql
```

### Backup schedule
- Daily automated backup at 02:00 UTC
- Retain for 30 days
- Test restore monthly

## 4. Incident Response

### P1: Complete outage (API unreachable)
1. Check Docker container status: `docker ps`
2. Check API logs: `docker logs saas-pos-api`
3. Check database health: `docker exec saas-pos-postgres pg_isready`
4. If database is down, restart postgres container
5. If API is down, restart api container
6. If neither helps, roll back to previous image

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
