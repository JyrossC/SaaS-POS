# Documentation Plan — SaaS Multi-Tenant POS Platform

## Goal
Create a complete documentation suite for the SaaS Multi-Tenant POS Platform, covering three audiences:

1. **Developer onboarding kit** — READMEs that tell human developers how to set up and run the project.
2. **AI-agent instruction set** — files that tell an AI coding agent what skills/tools it has and how to use them when building this platform.
3. **Project scaffolding guide** — documentation describing the module structure, conventions, and rules the codebase must follow.

## Source material
- `documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md` (1750+ lines, the authoritative blueprint)
- Existing project directory: `D:\Personal\Current Project\SaaS POS\` — contains the root README, the root `.kilo/` agent tooling, and the grouped documentation set under `documentations/`.

## Deliverables

### A. Developer onboarding kit (human developers)
| File | Purpose |
|---|---|
| `README.md` | Project overview, vision, architecture summary, quick start |
| `documentations/docs/developer/onboarding.md` | Prerequisites, local setup, environment config, first run |
| `documentations/docs/developer/development-workflow.md` | Build, test, lint, typecheck, migration, deploy commands |
| `documentations/docs/developer/contributing.md` | Branching, commit conventions, PR process, code review expectations |
| `documentations/docs/developer/environment-variables.md` | All env vars, secrets, defaults, per-environment behavior |

### B. AI-agent instruction set (AI coding agents)
| File | Purpose |
|---|---|
| `documentations/AGENTS.md` | Top-level agent identity, capabilities, tool usage rules, "do not" list |
| `.kilo/agent/pos-architect.md` | Skill: architecture decisions, tenant isolation, module boundaries |
| `.kilo/agent/pos-backend.md` | Skill: NestJS, Joi validation, Prisma/TypeORM, transactions, audit |
| `.kilo/agent/pos-frontend.md` | Skill: React, TanStack Query cache invalidation, RBAC-aware UI, design tokens |
| `.kilo/agent/pos-security.md` | Skill: auth, RBAC/ABAC, rate limiting, audit logging, secrets |
| `.kilo/agent/pos-testing.md` | Skill: test strategy, cross-tenant isolation tests, concurrency tests |
| `.kilo/command/*.md` | Reusable commands: scaffold-module, run-tests, migrate, lint, generate-api-docs |

### C. Project scaffolding guide (conventions & rules)
| File | Purpose |
|---|---|
| `documentations/docs/scaffolding/overview.md` | Layer map, module catalogue, dependency rules between modules |
| `documentations/docs/scaffolding/backend-conventions.md` | NestJS module layout, DTO schemas, error handling, naming, logging |
| `documentations/docs/scaffolding/frontend-conventions.md` | Feature folders, query keys, permission-aware components, state rules |
| `documentations/docs/scaffolding/database-conventions.md` | Prisma schema rules, tenant_id placement, FK constraints, indexes, migrations |
| `documentations/docs/scaffolding/api-conventions.md` | REST versioning, error envelope, pagination, idempotency, OpenAPI |
| `documentations/docs/scaffolding/design-system.md` | CSS tokens, component states, typography, responsive rules |

### D. MCP / tooling
| File | Purpose |
|---|---|
| `.kilo/mcp/README.md` | Declares MCP servers the agent may use (db, git, lint, test) and their config |
| `documentations/docs/devtools/README.md` | Dev tool inventory: Docker compose, Prisma, Jest/Vitest, ESLint, Swagger, CI/CD |

## Key rules to encode (from the blueprint)
- Tenant isolation is enforced at every data-access boundary; never trust `tenant_id` from the request.
- Subscription entitlements are checked server-side via a centralized `EntitlementService`; never enforce limits only in React.
- Hiding a menu item is not security — the API must enforce the same restrictions.
- Prices, taxes, totals are computed server-side; never trust frontend-supplied values.
- POS completion is a single DB transaction (sale, items, payments, inventory, audit).
- Pharmacy: batch-level stock is first-class; FEFO; expired stock sales prohibited.
- AI is advisory only; approved analytical operations only; no raw SQL from natural language.
- Audit logs for all sensitive actions; no stack traces in production errors.
- Empty states must support a genuinely empty database; no fabricated business data.

## Plan file location
`C:\Users\curti\.local\share\kilo\plans\1792843068940-pos-documentation-plan.md`

## Implementation order
1. Write top-level `README.md` + `documentations/AGENTS.md`.
2. Write developer kit (`documentations/docs/developer/*`).
3. Write agent skills (`.kilo/agent/*.md`) and commands (`.kilo/command/*.md`).
4. Write scaffolding guide (`documentations/docs/scaffolding/*`).
5. Write MCP/devtools docs (`.kilo/mcp/README.md`, `documentations/docs/devtools/README.md`).
6. Review for completeness against the blueprint; verify no fabricated business data instructions remain.

## Validation
- Every blueprint section (1–17) maps to at least one doc file.
- All files created; no source code modified.
- Cross-reference: tenant isolation, entitlement, RBAC/ABAC, pharmacy batch rules each appear in ≥2 docs (agent + scaffolding).