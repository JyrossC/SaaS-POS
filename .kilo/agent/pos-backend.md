# POS Backend Agent

This skill is for NestJS, API contracts, validation, persistence, and transaction design. The blueprint requires explicit tenant-aware backend enforcement.

## Backend defaults

- NestJS + TypeScript for the API layer
- REST endpoints with versioning and OpenAPI docs
- PostgreSQL as the source of truth
- Joi for explicit request validation
- Prisma or equivalent schema tooling
- Structured logging and guarded error responses

## Validation standards

Use centralized validation with reusable Joi schemas for:

- Request bodies
- Query params
- Route params
- DTO-level payloads where appropriate

Do not rely on frontend validation alone. The server must reject malformed or unauthorized inputs.

### Required validation rules

- Strict unknown-field handling
- Numeric bounds and monetary constraints
- Store and tenant scope checks
- Business-rule validation before persistence
- Database constraints as a second layer of protection

## Database and transaction rules

- Use transactions for any business operation that spans multiple writes.
- POS sales must commit in one database transaction that includes sale, items, payments, stock updates, and audit records.
- Inventory operations must respect product/tenant/store relationships.
- Pharmacy batch allocations require FEFO and expiry validation.
- Use unique idempotency keys for safe retries.

## Authorization enforcement

All sensitive endpoints must verify:

1. User is authenticated.
2. User belongs to the requested tenant.
3. User has the required permission.
4. Requested store is within allowed scope.
5. Resource belongs to the same tenant or authorized store.

The backend must not trust a client-provided tenant ID.

## Error handling

- Return standardized API errors.
- Never expose stack traces, JWTs, tokens, or internal secrets.
- Differentiate validation, authorization, conflict, and not-found errors.
- Log internal details with correlation IDs, but do not leak them to clients.

## Audit logging

Sensitive actions must emit structured audit records:

- Login failures and account changes
- Role/permission updates
- Staff deactivation or store changes
- Stock adjustments and transfer approvals
- Sale voids and refunds
- Price changes
- Pharmacy batch changes
- Subscription changes
- Platform support access

Audit records should capture actor, action, resource, timestamp, request context, and relevant metadata.

## Pharmacy backend requirements

- Batch inventory is first-class data, not a UI artifact.
- Expired stock must never be sold or dispensed.
- FEFO should be the default allocation strategy when multiple batches exist.
- Prescription and dispensing records must maintain traceability.
- Quarantine and returns must be treated as regulated workflows.

## API conventions

Follow these conventions when shaping routes and DTOs:

- Versioned API path: `/api/v1/...`
- Consistent JSON response envelope
- Pagination defaults and explicit sort rules
- Idempotent create/update behavior where possible
- Clear definitions for validation errors and authorization failures
- Swagger docs generated from controller metadata and DTO schema

## Testing expectations

Back-end work is not done without tests covering:

- Tenant isolation and cross-tenant access rejection
- Subscription entitlements and limit enforcement
- FIFO/FEFO selection when applicable
- Transaction rollback when part of a multi-step write fails
- Audit entry creation on sensitive actions

## Implementation checklist

- [ ] Route handlers resolve tenant and store from auth context
- [ ] Validation pipe and Joi schemas are centralized
- [ ] Transactions wrap multi-step business events
- [ ] Sensitive actions emit audit events
- [ ] Errors are sanitized before sending to clients
- [ ] Pharmacy stock selection is expiry-safe
- [ ] Rejected authorization attempts are tested explicitly
