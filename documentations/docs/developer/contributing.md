# Contributing

How to make changes, commit them, and get them merged.

## Branching

Use a feature-branch workflow. Never commit directly to `main`.

```bash
git checkout main
git pull
git checkout -b feature/<short-description>
# e.g. feature/pharmacy-batch-fefo
```

Name branches descriptively: `feature/*`, `fix/*`, `docs/*`, `chore/*`.

## Commit conventions

Use conventional commits. The commit message body should explain the **what and why**, not the how.

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | Purpose |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code change that neither fixes nor adds |
| `perf` | Performance improvement |
| `test` | Adding or improving tests |
| `chore` | Tooling, config, deps, build |
| `security` | Security hardening |

### Examples

```
feat(inventory): add FEFO batch allocation for pharmacy dispensing

When dispensing, prefer the batch with the earliest expiry date
that still has sufficient stock. Expired batches are never sold.

Closes #124
```

```
fix(saas): enforce tenant scope on stock transfer endpoint

The stock transfer endpoint was accepting a store_id from the
request body without verifying it belongs to the caller's tenant.
Scope is now derived from the authenticated membership.

Closes #218
```

## Writing good commits

- One logical change per commit.
- Keep the subject line under 72 characters.
- Reference issue numbers with `Closes #N`.
- Never commit secrets, keys, or `.env` files.

## Pull requests

1. Open the PR against `main`.
2. Title follows the commit convention.
3. Describe **what** changed and **why**.
4. Link related issues.
5. Note any assumptions or things the reviewer should pay attention to.

### PR checklist

- [ ] Tests added or updated for the change.
- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] `npm run test` passes, including isolation and concurrency tests.
- [ ] No fabricated business data added.
- [ ] No secrets or `.env` files committed.
- [ ] Audit events recorded for sensitive actions.
- [ ] Tenant isolation verified for any new data-access code.

## Code review

Every change needs review. Reviewers should:

- Check that tenant isolation is enforced at every data-access boundary.
- Check that subscription limits are enforced server-side, not only in React.
- Check that prices, taxes, and totals are computed server-side.
- Check that new sensitive actions are audited.
- Check that empty states support a genuinely empty database.

## Reporting issues

Include:

- Steps to reproduce.
- Expected vs. actual behavior.
- Environment (OS, Node version, browser).
- Relevant logs (redact secrets).
- Any tenant IDs or resource IDs involved.

For security issues, do **not** open a public issue. Follow the repository's security policy.