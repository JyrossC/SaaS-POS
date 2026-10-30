# Run Tests

Use this command to execute the relevant test suite for the changed area.

## Preferred execution

```bash
# Full project validation
npm run test
npm run lint
npm run typecheck
```

### Focused validation

```bash
# Tenant isolation and security checks
npm run test:isolation

# Concurrency and race-condition checks
npm run test:concurrency

# Pharmacy-specific rules
npm run test:pharmacy
```

## Hard-gate expectations

- Cross-tenant access tests must pass.
- Subscription limit tests must pass under concurrency.
- Pharmacy expiry/FEFO rules must pass.
- Transaction integrity tests must pass for sales and inventory writes.

## Guardrails

- Do not skip tests for tenant boundaries.
- Do not defer concurrency or expiry validation to later phases.
- Do not use production data in local test scenarios.
