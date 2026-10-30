# Development Phases

This document translates the blueprint's roadmap into an implementation sequence for the project team and the AI coding agent. All eight phases are complete.

## Phase 1: Requirements and architecture

### Status: Complete

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

### Status: Complete

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

### Status: Complete

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

### Status: Complete

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

### Status: Complete

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

### Status: Complete

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

### Status: Complete

### Goal

Implement reports and operational analytics.

### Deliverables

- dashboard metrics and formulas
- store comparisons and sales reports
- low-stock and expiry exposure views
- exports and reporting patterns

### Exit criteria

- all metrics have documented formula definitions
- BI stays scoped to the authorized tenant and store
- empty states work for zero-data scenarios

## Phase 8: AI analytics

### Status: Complete

### Goal

Introduce approved analytical support with strict controls.

### Deliverables

- sales forecasting and inventory recommendations
- AI analytics service with explicit data boundaries
- explanation and uncertainty handling
- policy and access enforcement
- monitoring and cost awareness

### Exit criteria

- AI is advisory and read-only where appropriate
- AI cannot bypass tenant or entitlement restrictions
- outputs are validated and explainable

## Cross-phase governance

Each phase satisfied:

- tenant isolation validation
- security and audit requirements
- empty-state compatibility
- test coverage for critical behavior
- requirement traceability to the source blueprint

## Implementation ordering rule

All phases completed in order: foundation -> identity -> entitlement -> retail -> pharmacy -> BI -> AI. The project is at full implementation status.
