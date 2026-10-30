# Generate API Docs

Use this command to regenerate the OpenAPI documentation for the NestJS API.

## Commands

```bash
npm run docs:api
npm run docs:api:serve
```

## Rules

- All public endpoints must have clear request and response schemas.
- Validation and authorization requirements should be visible in the spec.
- Return consistent error envelopes.
- Do not include secrets or internal stack-trace details in generated docs.

## Review checklist

- [ ] Tenant-scoped endpoints are documented
- [ ] Error responses are described clearly
- [ ] Query params and validators are included
- [ ] Public auth routes are marked correctly
- [ ] Swagger UI works in local development
