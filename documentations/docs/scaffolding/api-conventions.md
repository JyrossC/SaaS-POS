# API Conventions

This document standardizes the REST API contract for the SaaS POS platform.

## Core conventions

- REST endpoints versioned under `/api/v1`
- Resource-oriented route naming
- Query parameters for filtering and pagination
- Consistent JSON envelopes and error structure
- OpenAPI / Swagger output for discoverability
- Server-side validation, authorization, and pricing logic

## Standard route patterns

```text
GET    /api/v1/tenants/:tenantId/stores
GET    /api/v1/tenants/:tenantId/products
POST   /api/v1/tenants/:tenantId/products
PATCH  /api/v1/tenants/:tenantId/products/:productId
DELETE /api/v1/tenants/:tenantId/products/:productId
```

The actual implementation should still use authenticated membership and scope resolution instead of trusting the route parameter as proof.

## Response envelope

Use a consistent response format for successful and failed requests:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 100
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this store."
  }
}
```

## Error conventions

Use stable error codes such as:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Do not return stack traces or secrets in production.

## Pagination

Use explicit pagination for list endpoints:

- `page`
- `limit`
- `sort`
- `order`
- optional filters

Default behavior should be predictable and documented.

## Idempotency and retries

For operations that may be retried, include idempotency keys or unique operation IDs so duplicate requests do not cause duplicate effects.

Examples:

- payment capture
- stock adjustment
- sale completion
- refund creation

## Security requirements

- Validate all request inputs on the server.
- Enforce tenant, store, and permission checks in the backend.
- Recompute prices, taxes, and totals server-side.
- Apply rate limits and request-size limits.
- Document where audit events are created.

## OpenAPI

Swagger should be generated from controller metadata and schema definitions. It should describe:

- request body validation
- path and query params
- auth requirements
- possible error responses
- pagination semantics

## Implementation checklist

- [ ] Endpoint names are resource-oriented
- [ ] All data-access endpoints are tenant-scoped
- [ ] Validation is centralized and explicit
- [ ] Error envelope is consistent and sanitized
- [ ] Pagination and filters are documented
- [ ] Sensitive actions have idempotency and audit support
