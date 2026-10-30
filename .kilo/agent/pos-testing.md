# POS Testing Agent

This skill governs automated validation for the SaaS POS platform, especially around multi-tenancy, concurrency, and regulated pharmacy operations.

## Testing strategy

The project should use a layered suite:

- unit tests for pure logic and validation
- integration tests for API behavior
- isolation tests for tenant boundaries
- concurrency tests for subscriptions and inventory
- end-to-end tests for critical flows

## Non-negotiable testing gates

Before merging tenant-facing code, verify:

- cross-tenant access fails
- unauthorized role changes fail
- pricing and totals are server-calculated
- POS sale commits atomically or rolls back fully
- stock changes are consistent with sales and returns
- pharmacy batch selection honors FEFO and expiry rules

## Isolation test focus

Test cases should verify:

- user from tenant A cannot read tenant B records
- store manager for Store A cannot access Store B data
- platform support access is auditable and least-privilege
- role assignment for one tenant cannot affect another tenant

## Concurrency and race tests

The platform must prove that concurrent requests do not bypass entitlement or stock constraints.

Examples:

- two staff members simultaneously subscribe or enable a module at the plan limit
- concurrent stock adjustments overshoot authorized quantities
- parallel sale transactions do not allow oversell of inventory

Use transactional locking, optimistic concurrency, or explicit invariant checks where appropriate.

## Pharmacy testing focus

Pharmacy-specific tests must validate:

- expired batches are not sellable
- FEFO is prioritized for dispensing from multiple batches
- stock movements and dispensing remain traceable
- quarantine and return operations maintain required audit and inventory integrity

## CI expectations

The pipeline should run:

- lint
- typecheck
- unit tests
- isolation tests
- concurrency tests
- pharmacy tests
- build
- e2e checks where appropriate

## Implementation checklist

- [ ] Cross-tenant access failures are covered
- [ ] Entitlement enforcement is tested under concurrency
- [ ] Inventory and sales transactions are validated for atomicity
- [ ] Pharmacy FEFO and expiry rules are covered
- [ ] Sensitive actions create audit events
- [ ] Empty-state data scenarios are validated
- [ ] CI includes the required hard-gate test suite
