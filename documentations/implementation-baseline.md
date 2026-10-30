# Implementation Baseline

This baseline defines the architecture, tooling, and implementation standards that the platform must honor before active application development begins.

## 1. Executive baseline summary

The project will be built as a modular monolith with:

- React frontend for the user experience
- NestJS API for business logic and API enforcement
- PostgreSQL for durable transactional storage
- Prisma or equivalent schema tooling for migrations and model control
- explicit Joi validation and centralized validation pipelines
- RBAC/ABAC authorization with tenant store scoping
- centralized entitlement enforcement through backend services
- audit logging for sensitive business and support actions

## 2. Platform architecture

### 2.1 Boundaries

The application should respect three primary boundaries:

- Platform boundary: SaaS administration, subscription, tenant lifecycle, monitoring
- Tenant boundary: business operations, users, roles, permissions, stores, products, transactions
- Store boundary: store-specific inventory, cash, sales, operations, reporting

These boundaries must be enforced by API services and database constraints, not merely by navigation or UI hide/show logic.

### 2.2 Deployment direction

The recommended initial model is:

- local development first
- cloud deployment following successful validation
- online-first POS architecture with planned offline support later

This keeps the foundation correct before introducing synchronization strategies.

## 3. Technology baseline

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- CSS tokens for design system
- Recharts or Apache ECharts for analytics

### Backend

- NestJS
- TypeScript
- REST API with versioning
- PostgreSQL
- Joi validation
- Helmet
- Argon2id password hashing
- JWT or secure session model
- OpenAPI/Swagger generation
- structured logging
- background job queue as needed

### Data layer

- PostgreSQL as the transactional datastore
- Prisma or equivalent schema and migration tooling
- a shared database with tenant ownership and constraint enforcement
- no per-tenant databases in the first release

## 4. Security baseline

The platform must implement the following before operational data is exposed:

- authentication and session management
- password hashing and secure resets
- optional MFA for privileged users
- authorization by permission + scope
- platform/tenant/store separation
- rate limiting and CORS controls
- secret management and no `.env` commits
- audit logging for sensitive actions

## 5. Transaction baseline

The following business events must be atomic and auditable:

- completed sale
- payment settlement and reconciliation
- stock adjustment and transfer
- pharmacy batch allocation and dispensing
- refund and return processing
- subscription change affecting entitlements

## 6. Entitlement and authorization baseline

The effective feature availability model is:

```text
Feature available =
  Platform permits feature
  AND subscription includes feature
  AND tenant has enabled feature
  AND user has the required permission
  AND requested store is accessible
```

This logic must be evaluated on the server at the API boundary and in the entitlement service.

## 7. Data baseline

### 7.1 Schema expectations

The schema must support:

- users
- tenants
- tenant memberships
- roles and permissions
- subscriptions and entitlements
- stores and membership store scopes
- products and inventory
- sales, payments, refunds, and cash management
- pharmacy batch tracking and dispensing data
- audit logs and notifications

### 7.2 Integrity expectations

Critical protections include:

- tenant-scoped uniqueness where appropriate
- cross-tenant relationship validation
- FK enforcement and DB-level constraint checks
- monetary and quantity constraints
- inventory invariant checks
- idempotency support for retriable operations

## 8. UX and design baseline

The application should maintain a clean, premium design system built on centralized tokens:

- burgundy brand accents
- ivory background
- white cards and restrained borders
- clear typography system
- consistent empty states
- operational and analytical dashboard separation

## 9. Testing baseline

The minimum hard-gate suite must include:

- tenant isolation tests
- auth and permission tests
- entitlement limit tests under concurrency
- sales and inventory transaction tests
- pharmacy FEFO and expiry tests
- audit event verification tests

## 10. Phase readiness gate

No module should begin without the following being in place:

- module ownership and API contract
- permission model and scope rules
- DB schema and migration strategy
- validation and error-handling plan
- test cases for the core workflow
- audit requirement for sensitive actions

## 11. Baseline exit criteria

The application is ready to move to implementation once these conditions are satisfied:

- architecture and module boundaries are approved
- authorization model is finalized
- entitlement engine is designed
- transaction and pharmacy constraints are defined
- testing strategy is documented
- design and frontend conventions are accepted

At that point, implementation can proceed in the staged roadmap without redesigning the core platform rules.
