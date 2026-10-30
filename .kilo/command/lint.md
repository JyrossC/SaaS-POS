# Lint and Typecheck

Use these commands to validate code quality and static correctness before merging.

## Commands

```bash
# Lint the monorepo
npm run lint

# Auto-fix lint issues where safe
npm run lint:fix

# Type-check both apps
npm run typecheck

# App-specific type checks
npm run typecheck:web
npm run typecheck:api
```

## Expectations

- Keep code aligned to the repository style and architecture rules.
- Fix or justify lint warnings that are introduced by the change.
- Type-checks must pass before shipping a feature branch.

## Guardrails

- Do not use lint suppression for tenant-scoping or authorization logic.
- Do not skip static validation for permission-sensitive code.
- Do not accept code that hides a real bug behind broad casts or `any` when the domain is typed.
