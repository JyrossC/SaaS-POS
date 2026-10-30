# Scaffolding Overview

This repository defines the recommended structure for the SaaS Multi-Tenant POS Platform before application code is created. The goal is to keep the codebase modular, tenant-safe, and aligned with the architecture blueprint.

## Recommended workspace layout

```text
apps/
├── web/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── shared/
│   │   ├── styles/
│   │   └── lib/
│   └── public/
└── api/
    └── src/
        ├── app.module.ts
        ├── main.ts
        ├── auth/
        ├── platform/
        ├── tenants/
        ├── memberships/
        ├── authorization/
        ├── subscriptions/
        ├── entitlements/
        ├── stores/
        ├── products/
        ├── inventory/
        ├── purchasing/
        ├── sales/
        ├── payments/
        ├── pharmacy/
        ├── reporting/
        ├── ai/
        ├── audit/
        ├── notifications/
        └── common/
```

## Architecture principles

- Keep platform, tenant, and store concerns separated.
- Do not let UI code define the real security boundary.
- Keep domain rules in the backend services, not in React components.
- Prefer module boundaries that map to business capabilities rather than technical layers alone.

## Domain boundary rules

### Platform

- subscription plans
- tenant management
- billing and invoices
- module catalogue
- platform support access
- SaaS metrics

### Tenant

- staff and memberships
- roles and permissions
- business profile
- module configuration
- stores and store scopes

### Store

- inventory balances
- POS cash flows
- store transfers
- cashier workflows
- local reporting

## Dependency rules

- Platform modules may not read tenant data without explicit support authorization.
- Tenant modules may not bypass entitlement or permission evaluation.
- Store-level logic must always be scoped by the tenant and store permission model.
- Reporting and BI logic must respect tenant and store scope.

## Module conventions

A standard API module should contain:

```text
products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── products.repository.ts
├── products.schemas.ts
├── products.types.ts
├── products.spec.ts
└── dto/
    ├── create-product.dto.ts
    └── update-product.dto.ts
```

Use feature-driven folders and keep controller, service, repository, validation, and tests in one feature cluster.

## Shared services

Place code in common helpers for:

- authorization and scope resolution
- tenant-aware query helpers
- audit logging
- entitlement checks
- API error handling
- pagination and request metadata

## Data access rules

- Every query against tenant-owned data must resolve the current tenant context.
- Cross-tenant relationship checks must be enforced with DB constraints and not only application logic.
- Use transactions for multi-step business events such as sales and pharmacy dispensing.

## Frontend conventions

The web app should also use feature-based organization:

```text
apps/web/src/features/
├── auth/
├── dashboard/
├── products/
├── inventory/
├── sales/
├── pharmacy/
├── reporting/
└── admin/
```

Each feature should include:

- route-level entry points
- server-state queries and mutations
- local form state with clear validation
- permission-aware rendering
- consistent empty-state patterns

## Validation and consistency checks

Before merging a new module, confirm:

- scope is enforced in the API
- UI is permission-aware but not the security boundary
- a transaction exists for multi-step business actions
- sensitive actions log audit events
- zero-data scenarios are supported
