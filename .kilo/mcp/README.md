# MCP Tooling README

This workspace declares the MCP-based tooling that an AI coding agent may use while working on the SaaS POS platform. The goal is to standardize access to infrastructure, verification, and repo-aware operations.

## Declared tool categories

### Database and schema tooling

- PostgreSQL access for migrations, schema inspection, and data validation
- Prisma-aware tooling for schema generation and migration review
- Tenant-aware query validation for cross-tenant safety

### Git and repository tooling

- Branch and commit review
- Diff inspection
- Merge and PR coordination when explicitly requested

### Testing and linting

- Test runner integration
- Lint and type-check commands
- Focused validation during implementation and before merge

### API and docs tooling

- OpenAPI generation review
- Swagger checks
- API contract validation

## Expected configuration pattern

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@prisma/migrate", "status"]
    },
    "git": {
      "command": "git",
      "args": ["--no-pager", "status"]
    },
    "lint": {
      "command": "npm",
      "args": ["run", "lint"]
    },
    "test": {
      "command": "npm",
      "args": ["run", "test"]
    }
  }
}
```

## Security and usage rules

- Only use MCP tooling that is required for the task.
- Never expose secrets in tool arguments or logs.
- Do not run database writes outside explicit migration or testing flows.
- Respect tenant isolation while inspecting or validating data.
- Do not use MCP tools to fabricate operational data.

## Required workflow

When working on implementation tasks:

1. Read the blueprint and relevant docs.
2. Work within the appropriate module boundary.
3. Validate with the smallest relevant test command.
4. Confirm that tenant, store, and entitlement checks are unchanged or strengthened.
