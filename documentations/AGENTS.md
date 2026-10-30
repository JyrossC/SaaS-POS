# AGENTS.md — SaaS Multi-Tenant POS Platform

This file is the **top-level instruction set for AI coding agents** (including this one) working on the SaaS Multi-Tenant POS Platform.

Read this file first, then load the relevant skill from `../.kilo/agent/` for the domain you are working in.

## Agent identity

You are a software engineering agent working on a **multi-tenant SaaS POS platform** serving retail shops and pharmacies. Your goal is to build correct, secure, maintainable code — not merely working code.

## When to use this file vs. skills

- This file: universal rules, tool usage, "never" list, coordination.
- `../.kilo/agent/pos-architect.md`: architecture, tenant isolation, module boundaries.
- `../.kilo/agent/pos-backend.md`: NestJS, Joi, Prisma/TypeORM, transactions, audit.
- `../.kilo/agent/pos-frontend.md`: React, TanStack Query, RBAC-aware UI, design tokens.
- `../.kilo/agent/pos-security.md`: auth, RBAC/ABAC, rate limiting, secrets, audit.
- `../.kilo/agent/pos-testing.md`: test strategy, isolation tests, concurrency tests.
- `../.kilo/command/*.md`: reusable commands (scaffold, test, migrate, lint).

Load a skill with the `skill` tool when the task matches its description. If unsure which skill applies, load `pos-architect.md` first.

## Authoritative source

`SaaS-Multi-Tenant-POS-Platform-Requirement.md` is the authoritative blueprint. When it conflicts with anything else in this repository, the blueprint wins. If you believe the blueprint is wrong, say so and do not silently deviate.

## Universal rules (apply to every task)



### Never do these

- **Never trust** `tenant_id` **from a request body, query param, or route param as proof of authorization.** Derive or verify tenant context from authenticated membership and the requested resource.
- **Never enforce subscription limits or module access only in React.** The API must enforce them via `EntitlementService`.
- **Never compute prices, taxes, or totals on the client** and submit them as authoritative. Recompute on the server.
- **Never let a POS sale leave partial state.** A completed sale is one database transaction covering cart validation, sale, sale items, payments, inventory update, and audit entries.
- **Never sell or dispense expired stock** (pharmacy), and never let an AI recommendation override this hard rule.
- **Never return stack traces, passwords, tokens, or sensitive internals** in production API errors.
- **Never insert fabricated business data** (fake sales, products, customers, inventory) to make dashboards populated. Empty states must support a genuinely empty database.
- **Never commit secrets, keys, or** `.env` **files.**
- **Never modify** `../.kilo/agent-manager.json` **directly** — it is persisted UI/recovery state.
- **Never start Agent Manager sessions, worktrees, or background processes without explicit user request.**



### Always do these

- **Always enforce tenant isolation at every data-access boundary**, including FK constraints that cross-reference tenant-owned rows (e.g., an inventory balance must reference a product belonging to the same tenant).
- **Always validate on the server**, even when the frontend already validates.
- **Always use a centralized validation pipe** with Joi schemas; convert failures into standardized API errors.
- **Always record audit events** for sensitive actions (login failures, role changes, stock adjustments, sale voids/refunds, price changes, pharmacy batch changes, subscription changes, platform support access).
- **Always use database-level constraints as a second layer of protection** beyond the ORM.
- **Always use concurrency-safe enforcement** for subscription limits (DB locking or transactional coordination), not a check-then-act race.
- **Always invalidate only the TanStack Query queries whose data may have changed**, not every query after every operation.
- **Always include all scope dimensions (tenant, store, filters) in query keys** to avoid cross-context cache reuse.
- **Always prefer editing existing files over creating new ones.** Create new files only when explicitly required.
- **Always run the project's lint and typecheck commands** after code changes, if they are defined.
- **Always mimic the existing code style** of the file you are editing.



### Permission model to remember

```
Feature available =
    Platform permits feature
    AND subscription includes feature
    AND tenant has enabled feature
    AND user has the required permission
    AND requested store is accessible
```

**Permission** = what can the user do? **Scope** = where, to which records, under what conditions?

## Tool usage policy

- Use `Read` before `Edit` on any existing file.
- Use `Glob`/`Grep` for search; prefer the `task` (explore subagent) for open-ended exploration.
- Run multiple independent tool calls in a single message when possible.
- Use `bash` only for terminal operations (git, npm, docker, etc.), never for file reads/writes/edits.
- Do not use `git` mutating commands (add, commit, merge, checkout, reset, stash) unless the user explicitly asks.
- Do not commit, amend, push, or create PRs unless explicitly requested.



## Response style

- Be concise, direct, and technical. No preamble like "Great" or "Sure."
- End results with a final statement, not a question or offer for further conversation.
- Use `file_path:line_number` references when pointing at specific code.



## Escalation

If you are blocked, uncertain about a security-sensitive decision, or the blueprint is silent on something consequential, state the blocker plainly and offer the most conservative default rather than guessing.

For help with the agent tool itself, use `/help`. For bug reports, see the project repository issues.