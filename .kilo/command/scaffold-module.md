# Scaffold Module

Use this workflow to create a new module in the API or web application while keeping the platform conventions intact.

## Goal

Create a feature area with consistent naming, validation, code structure, and access control.

## Standard module layout

### API module

```text
apps/api/src/<module>/
├── <module>.module.ts
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.repository.ts
├── <module>.schemas.ts
├── <module>.types.ts
├── <module>.spec.ts
└── dto/
    ├── create-*.dto.ts
    └── update-*.dto.ts
```

### Web feature

```text
apps/web/src/features/<module>/
├── <module>.routes.tsx
├── <module>.page.tsx
├── <module>.queries.ts
├── <module>.mutations.ts
├── <module>.types.ts
├── components/
└── hooks/
```

## Required checks

Before finalizing a new module:

- Tenant scope is derived from auth context
- Store scope is validated
- API validation uses Joi or the shared validation pipe
- Subscription entitlements are checked server-side
- Sensitive actions audit themselves
- Empty states are defined for zero-data scenarios

## Example command flow

```bash
# API
nest g module modules/<module>
nest g controller modules/<module>
nest g service modules/<module>

# Web
mkdir -p apps/web/src/features/<module>
```

## Guardrails

- Do not accept direct tenant IDs from the client as authorization proof.
- Do not compute authoritative prices or totals on the frontend.
- Do not skip migration and validation work for database changes.
- Do not create fake seed data for operational dashboards.
