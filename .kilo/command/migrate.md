# Database Migrations

Use this workflow when schema or persistence rules change.

## Commands

```bash
# Create a migration
npm run migrate:create -- --name <migration-name>

# Apply pending migrations
npm run migrate:deploy

# Reset local database and reapply schema
npm run migrate:reset

# Regenerate Prisma client after schema changes
npm run prisma:generate
```

## Required rules

- Never edit an already-applied migration in place.
- Add a new migration for any schema change.
- Include a tenant-aware constraint and index plan for new tables.
- Verify cross-tenant relationship safety in tests.

## Review checklist

- [ ] Data model remains tenant-scoped where required
- [ ] Foreign keys match tenant/store ownership rules
- [ ] Unique constraints do not accidentally break legitimate workflows
- [ ] Indexes support reads without exposing cross-tenant data
- [ ] Migration is safe for CI and staging deployment
