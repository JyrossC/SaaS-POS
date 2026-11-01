# Development Phases

This document describes the implementation sequence. The phases are **not complete**: the repository contains partial implementations, unresolved product decisions, and failing or missing verification gates. See the [full-system production-readiness roadmap](production-readiness-roadmap.md) for detailed statuses, dependencies, and acceptance evidence. Phase exit criteria below are targets, not claims that they have passed.

## Phase 1: Requirements and architecture

### Status: Partial — business and regulatory decisions remain open

### Goal

Lock the business rules, system boundaries, and technical direction before implementation begins.

### Deliverables

- business requirements and use-case catalogue
- architecture boundaries: platform, tenant, store
- database design and constraint plan
- RBAC + ABAC policy model
- entitlement model
- design system and UI guidance
- API convention standards
- test strategy

### Exit criteria

- all core modules have assigned responsibilities
- permissions, entitlements, and audit requirements are defined
- documentation is consistent with the requirement blueprint

## Phase 2: Application foundation

### Status: Partial — web lint/test, API documentation, and full CI gates remain

### Goal

Create the runtime foundation and shared tooling.

### Deliverables

- React app shell and route layout
- NestJS application foundation
- PostgreSQL connectivity and migration tooling
- validation and error handling
- logging, security headers, and environment configuration
- Swagger/OpenAPI setup
- initial automated test harness

### Exit criteria

- the API and web app can run locally
- the database can connect and migrate
- validation and API docs work

## Phase 3: Identity, tenancy, and authorization

### Status: Partial — end-to-end identity, admin, and security acceptance remains

### Goal

Create secure identity and authorization foundations.

### Deliverables

- auth, users, and memberships
- tenant and store scope evaluation
- roles and permissions
- platform and tenant admin access separation
- audit log foundation

### Exit criteria

- cross-tenant access attempts fail
- user can only access authorized stores and tenants
- audit events are created for sensitive actions

## Phase 4: Subscription and entitlement engine

### Status: Partial — complete billing lifecycle and concurrency acceptance remain

### Goal

Add package and module gating to the platform.

### Deliverables

- subscription plans and plan versions
- entitlement definitions
- tenant subscription state
- usage and package-limit enforcement
- transactional concurrency protection for limit checks

### Exit criteria

- subscription limits enforce correctly under concurrent requests
- module access is derived from configuration, entitlements, and roles

## Phase 5: Core retail operations

### Status: Partial — several commerce workflows and release evidence remain

### Goal

Build the operational retail functions.

### Deliverables

- products and pricing
- suppliers and purchasing
- inventory and stock movement
- POS and sale processing
- payments and receipts
- returns and refunds
- cash management and reporting basics

### Exit criteria

- a full sale can be committed atomically
- inventory, payments, and audit events remain consistent
- reports reflect real persisted data only

## Phase 6: Pharmacy operations

### Status: Partial — regulatory acceptance, UI, and passing workflow tests remain

### Goal

Implement regulated pharmacy workflows and inventory control.

### Deliverables

- drug catalogue and batch inventory
- expiry tracking and FEFO allocation
- prescription and dispensing workflows
- quarantine and batch adjustments
- pharmacy-specific reporting

### Exit criteria

- expired stock cannot be sold or dispensed
- FEFO and batch selection are enforced reliably
- traceability is preserved across dispensing and returns

## Phase 7: Business intelligence

### Status: Partial — exports, margin, metric validation, and UI acceptance remain

### Goal

Implement reports and operational analytics.

### Deliverables

- dashboard metrics and formulas
- store comparisons and sales reports
- low-stock and expiry exposure views
- reporting patterns

**Not implemented (future work):**
- exports (CSV/PDF)
- gross profit and margin reports

### Exit criteria

- all metrics have documented formula definitions
- BI stays scoped to the authorized tenant and store
- empty states work for zero-data scenarios

## Phase 8: AI analytics

### Status: Partial — rule-based analytics exists; the full approved AI scope remains

### Goal

Introduce approved analytical support with strict controls.

### Deliverables

- rule-based query classification for analytical reporting
- AI analytics service with explicit data boundaries
- explanation handling (rule-based summaries, no confidence scoring)
- policy and access enforcement
- monitoring and cost awareness

**Not implemented (future work):**
- sales forecasting — no ML model or forecasting algorithm
- inventory recommendations — no replenishment logic

### Exit criteria

- AI is advisory and read-only where appropriate
- AI cannot bypass tenant or entitlement restrictions
- outputs are validated and explainable
- AI is explicitly described as rule-based, not ML-driven

## Cross-phase governance

Each phase must demonstrate:

- tenant isolation validation
- security and audit requirements
- empty-state compatibility
- test coverage for critical behavior
- requirement traceability to the source blueprint

## Implementation ordering rule

Implementation should follow the dependency order: foundation -> decisions and identity -> entitlement -> retail -> pharmacy -> BI/AI -> offline -> production operations. No phase is considered complete until its acceptance criteria are evidenced; the project is not at full implementation status.
