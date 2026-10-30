# SaaS Multi-Tenant POS Platform

A multi-tenant commerce management platform serving **retail shops** and **pharmacies** through a shared SaaS infrastructure, with subscription-controlled capabilities, tenant isolation, configurable authorization, business intelligence, and AI-assisted decision-making.

## What this repository contains

This repository contains the platform blueprint, developer documentation, and a fully implemented monorepo. The implementation covers all eight development phases: identity/tenancy/authorization, subscription/entitlement engine, core retail operations (products, inventory, POS sales, purchasing, cash sessions, returns/refunds), pharmacy operations (batches, expiry/FEFO, prescriptions, dispensing, quarantine), business intelligence/reporting, and AI analytics. The NestJS API includes all modules, the React frontend includes the design system, layout shell, auth pages, and feature pages, and PostgreSQL migrations are applied and validated.

- The authoritative architecture and design blueprint in [`documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md`](<C:/Personal/Current Project/SaaS POS/documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md>).
- A developer onboarding kit in [`documentations/docs/developer/`](<C:/Personal/Current Project/SaaS POS/documentations/docs/developer/>).
- An AI-agent instruction set in [`documentations/AGENTS.md`](<C:/Personal/Current Project/SaaS POS/documentations/AGENTS.md>) plus the root-level skill command folders at [`.kilo/`](<C:/Personal/Current Project/SaaS POS/.kilo/>).
- A project scaffolding guide in [`documentations/docs/scaffolding/`](<C:/Personal/Current Project/SaaS POS/documentations/docs/scaffolding/>).
- MCP and development tooling documentation in [`.kilo/mcp/`](<C:/Personal/Current Project/SaaS POS/.kilo/mcp/>) and [`documentations/docs/devtools/`](<C:/Personal/Current Project/SaaS POS/documentations/docs/devtools/>).

## System architecture at a glance

| Layer | Responsibility | Implemented Modules |
|---|---|---|
| Platform Management | SaaS administration, tenant management, subscriptions, billing, package configuration, platform analytics | Platform module, subscription lifecycle, KYB review, payment providers |
| Tenant Management | Business configuration, staff, roles, permissions, stores, operational settings | Tenant module, stores module, membership/roles |
| Commerce Operations | POS, products, sales, inventory, purchasing, customers, suppliers, returns | Products, inventory, purchasing, sales, cash sessions, returns |
| Intelligence | Business intelligence, reporting, forecasting, AI-assisted analytics | Reporting module, AI analytics service |
| Infrastructure | Authentication, authorization, database, audit logs, security, notifications, integrations | Auth module, authorization guard, Prisma, audit logs |

**Recommended starting shape:** one React application, one NestJS REST API, one PostgreSQL database. Enforce tenant isolation at every relevant data-access boundary. Build a modular monolith rather than introducing microservices prematurely.

## Business types supported

| Business type | Description |
|---|---|
| `RETAIL` | General retail shops |
| `PHARMACY` | Pharmacy branches with batch/expiry/prescription workflows |
| `HYBRID` | Retail products alongside regulated health products |

## Documentation map

```
README.md                                       <- You are here
documentations/
├── AGENTS.md                                    <- AI-agent instruction set
├── SaaS-Multi-Tenant-POS-Platform-Requirement.md <- Authoritative blueprint
├── project-tracking.md                           <- Project delivery tracker
├── traceability.csv                             <- Requirement traceability matrix
├── implementation-baseline.md                   <- Implementation baseline
├── app-features.md                              <- Platform feature catalogue
├── development-phase.md                         <- Execution roadmap
├── docs/
│   ├── developer/                               <- Human developer onboarding kit
│   ├── scaffolding/                             <- Module structure & conventions
│   └── devtools/                                <- Development tooling inventory
└── pos-documentation-plan.md                   <- Planning record

.kilo/
├── agent/                                      <- Specialized agent skills
├── command/                                    <- Reusable agent commands
└── mcp/                                        <- MCP server declarations
```

## Quick orientation

- **Humans starting out** → [`documentations/docs/developer/onboarding.md`](<C:/Personal/Current Project/SaaS POS/documentations/docs/developer/onboarding.md>)
- **AI agents working on this codebase** → [`documentations/AGENTS.md`](<C:/Personal/Current Project/SaaS POS/documentations/AGENTS.md>), then [`.kilo/agent/`](<C:/Personal/Current Project/SaaS POS/.kilo/agent/>)
- **Want to know how a module should be structured** → [`documentations/docs/scaffolding/overview.md`](<C:/Personal/Current Project/SaaS POS/documentations/docs/scaffolding/overview.md>)

## Core principles (non-negotiable)

1. **Tenant isolation is enforced at every data-access boundary.** Never trust `tenant_id` from a request; derive or verify it from authenticated membership and the requested resource.
2. **Subscription entitlements are checked server-side** via a centralized `EntitlementService`. Never enforce limits only in React.
3. **Hiding a menu item is not security.** The API must enforce the same restrictions the UI implies.
4. **Prices, taxes, and totals are computed server-side.** Never trust frontend-supplied values.
5. **A completed POS sale is a single database transaction.** No partial state (sale without payment, or stock updated without sale).
6. **Pharmacy batch-level stock is first-class.** FEFO allocation, expiry validation, no expired-stock sales.
7. **AI is advisory only.** Approved analytical operations only; no raw SQL from natural language.
8. **Every sensitive action is audited.** No stack traces in production errors.
9. **Empty states support a genuinely empty database.** No fabricated business data to make dashboards look populated.

## Stack summary

**Frontend:** React.js, TypeScript, Vite, React Router, CSS variables for design tokens (per SEC-DS-001), semantic component library (Button, Input, Card, Badge, LoadingState, EmptyState, ErrorState, ForbiddenState).

**Backend:** NestJS, TypeScript, REST API, PostgreSQL, Joi validation, Helmet, Argon2id, JWT/secure sessions, OpenAPI/Swagger, structured logging, background job queue.

**Infrastructure:** CI/CD pipeline (GitHub Actions), automated database migrations, background job worker, Docker Compose for local PostgreSQL.

## Implementation status (all phases complete)

| Phase | Focus | Status |
|---|---|---|
| 1 | Requirements and architecture | Complete |
| 2 | Application foundation | Complete |
| 3 | Identity, tenancy, and authorization | Complete |
| 4 | Subscription and entitlement engine | Complete |
| 5 | Core retail operations | Complete |
| 6 | Pharmacy modules | Complete |
| 7 | Business intelligence and reporting | Complete |
| 8 | AI analytics | Complete |

### Implemented modules

- **Auth:** Login (tenant slug + email + password), tenant registration with plan selection, invitation acceptance, platform admin auth
- **Tenancy:** Tenant context resolution, store CRUD, membership/role/permission scoping, cross-tenant isolation
- **Authorization:** Decorator-based `RequirePermissions`, `PermissionGuard`, 40+ system permissions
- **Subscription:** Plan lifecycle (change, renew, suspend, reactivate), entitlement checks, invoice/payment recording, concurrency-safe limit enforcement
- **Products:** Tenant-scoped catalogue CRUD, SKU uniqueness, paginated search
- **Inventory:** Atomic stock adjustments, idempotency keys, negative-stock prevention, audit logging
- **Purchasing:** Suppliers, purchase orders, goods receipts with inventory updates
- **POS Sales:** Atomic sale transactions, server-side pricing, inventory decrement, payments, void with restoration
- **Cash Sessions:** Open/close with expected vs actual balance variance
- **Returns & Refunds:** Refund creation with inventory restoration and audit
- **Pharmacy:** Drug details, product batches, FEFO allocation, dispensing records, quarantine/release, expiring batch detection
- **BI/Reporting:** Sales summary, inventory report, store comparison
- **AI Analytics:** Intent classification, approved analytical operations only
- **Platform:** First-run installation, KYB encrypted documents, tenant approval gate, payment provider configuration

## License and feedback

This is a production-ready implementation. Feedback on the architecture should reference the section numbers in [`documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md`](<C:/Personal/Current Project/SaaS POS/documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md>).
