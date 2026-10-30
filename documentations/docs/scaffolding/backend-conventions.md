# Backend Conventions

This file describes the expected NestJS and API conventions for the SaaS POS platform.

## API technology defaults

- NestJS + TypeScript
- REST API with versioning (`/api/v1/...`)
- Joi-based validation
- OpenAPI generation
- PostgreSQL-backed persistence
- Structured logging and standard errors

## Module structure

Each feature should be organized as a self-contained domain module:

```text
src/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts
├── <feature>.schemas.ts
├── <feature>.types.ts
├── <feature>.spec.ts
└── dto/
    ├── create-*.dto.ts
    └── update-*.dto.ts
```

## DTO and validation expectations

- Validate body, params, and query inputs explicitly.
- Reject unknown fields.
- Include monetary and numeric constraints.
- Validate store and tenant scope before persistence.
- Prefer reusable schemas and centralized validation pipes.

## Service and business rules

Business logic belongs in the service layer. Controllers should be thin and orchestration-focused.

A service must:

- resolve tenant and store within the authenticated context
- enforce permissions and entitlements
- apply business rules before any data write
- wrap multi-step work in a transaction when necessary

## Error handling conventions

Use a consistent error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request data is invalid.",
    "details": []
  }
}
```

Rules:

- never leak stack traces
- never expose sensitive tokens or secrets
- keep log details internal and traceable

## Audit requirements

Any sensitive endpoint should emit an audit log or use a centralized audit service helper. Examples:

- staff or role updates
- inventory adjustments
- sale voids and refunds
- subscription changes
- pharmacy batch modifications

## Transaction rules

Use database transactions for:

- sale completion
- returns and refunds
- inventory transfer between stores
- stock count reconciliation
- pharmacy dispensing and batch updates

## Security guardrails

- Do not trust request-provided `tenant_id` or `store_id`.
- Derive scope from authenticated membership and allowed resources.
- Ensure module access is enforced on the API side.
- Never allow the frontend to determine authoritative totals.

## Naming preferences

- Use resource-oriented names: `products`, `sales`, `inventory`, `pharmacy`
- Use verbs only for actions and route semantics, not as the domain model
- Keep permission names consistent with the RBAC catalogue
- Prefer descriptive, stable names over abbreviations
