# POS Architecture Agent

This skill guides architecture work for the SaaS Multi-Tenant POS Platform. Use it when designing modules, boundaries, or cross-cutting decisions.

## Mission

Keep the system secure, tenant-isolated, and extensible without prematurely introducing service boundaries. The default shape is a modular monolith: React web app + NestJS API + PostgreSQL.

## Non-negotiable architecture rules

- Tenant isolation is enforced at every data-access boundary.
- Never trust request-provided `tenant_id`, `store_id`, or similar values as proof of authorization.
- Subscription entitlements are enforced server-side by a centralized `EntitlementService`.
- Compute prices, taxes, totals, and inventory effects on the server.
- A completed POS sale is a single transaction across sale, items, payments, inventory, and audit data.
- Pharmacy rules are hard constraints, not advisory recommendations.
- Empty states must work with an empty database and never rely on fabricated business data.

## Architecture boundaries

### Platform boundary

- Tenant onboarding, billing, subscription packages, module catalog, platform admin, monitoring.
- Global configuration and SaaS operations.
- Cross-tenant analytics and support access only with strict auditing and least privilege.

### Tenant boundary

- Business configuration, user memberships, roles, stores, products, transactions, reporting.
- Data ownership belongs to the tenant, never to a single store or role.

### Store boundary

- Store inventory, POS transactions, cash sessions, local stock movements, store-level permissions.
- Store-level access is derived from membership scope and policy evaluation.

## Recommended starting stack

- Frontend: React + TypeScript + Vite
- API: NestJS + TypeScript + REST + OpenAPI
- Database: PostgreSQL
- Validation: Joi (server-side, explicit)
- Data layer: Prisma or equivalent controlled schema tooling
- Auth: Argon2id + JWT or secure session model
- Observability: structured logging + error tracking + audit logs

## Data and domain design principles

- Use a shared database with tenant ownership rather than per-tenant databases initially.
- Keep a single source of truth for tenant, store, user, entitlement, and audit context.
- Use table-level and query-level scoping to prevent cross-tenant leakage.
- Enforce FK and database constraints beyond just application checks.

## Authorization model

Feature availability is determined by:

```text
Feature available =
  Platform permits feature
  AND subscription includes feature
  AND tenant has enabled feature
  AND user has required permission
  AND requested store is accessible
```

This must be evaluated on the API side. UI hiding a menu item is not a security control.

## Module sequencing

Phase order should follow the blueprint, not feature excitement:

1. Identity, tenancy, and authorization
2. Subscription and entitlement engine
3. Core retail operations
4. Pharmacy operations
5. BI and reporting
6. AI analytics

## Design guidance for new modules

- Keep modules feature-based: `products`, `inventory`, `sales`, `pharmacy`, `reporting`, `ai`.
- Shared logic goes into `common` or `shared` services, not repeated across modules.
- Domain rules belong near the service layer; HTTP concerns stay in controllers.
- Use repository or query modules only where query complexity or tenant scoping would otherwise be duplicated.

## Questions to ask before approving a design

- Does the implementation verify tenant membership and store scope from the authenticated user?
- Is the decision enforced in the API and database, not only in UI code?
- Are audit events recorded for changes to sensitive data?
- Are there tests proving cross-tenant access fails?
- Does the design leave an empty database in a valid empty state?

## Implementation checklist

- [ ] Tenant and store are resolved from the authenticated context, not the request body
- [ ] API validation uses Joi schema validation
- [ ] Transaction boundaries cover the business event end-to-end
- [ ] Access control uses both permission and scope
- [ ] Audit records exist for sensitive changes
- [ ] Background jobs and analytics do not bypass tenant scoping
- [ ] Empty-state UI and zero-value reports are supported
