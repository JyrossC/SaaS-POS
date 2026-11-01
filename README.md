# SaaS Multi-Tenant POS Platform

A multi-tenant commerce management platform serving **retail shops** and **pharmacies** through a shared SaaS infrastructure, with subscription-controlled capabilities, tenant isolation, configurable authorization, business intelligence, and AI-assisted decision-making.

## What this repository contains

This repository contains the platform blueprint, developer documentation, and a partially implemented monorepo. Backend modules and frontend feature scaffolding exist, but the complete workflows and release gates are not yet verified; the project is not production-ready. See the [full-system production-readiness roadmap](documentations/production-readiness-roadmap.md) for the evidence-based status, dependencies, acceptance criteria, unresolved decisions, and release gates.

- The authoritative architecture and design blueprint in [the requirements document](documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md).
- A developer onboarding kit in [the developer documentation](documentations/docs/developer/).
- An AI-agent instruction set in [documentations/AGENTS.md](documentations/AGENTS.md) plus the root-level skill command folders in [`.kilo/`](.kilo/).
- A project scaffolding guide in [the scaffolding documentation](documentations/docs/scaffolding/).
- MCP and development tooling documentation in [`.kilo/mcp/`](.kilo/mcp/) and [documentations/docs/devtools/](documentations/docs/devtools/).

## System architecture at a glance

| Layer | Responsibility | Code areas present (not release-certified) |
|---|---|---|
| Platform Management | SaaS administration, tenant management, subscriptions, billing, package configuration, platform analytics | Platform module, subscription lifecycle, KYB review, payment providers |
| Tenant Management | Business configuration, staff, roles, permissions, stores, operational settings | Tenant module, stores module, membership/roles |
| Commerce Operations | POS, products, sales, inventory, purchasing, customers, suppliers, returns | Products, inventory, purchasing, sales, cash sessions, returns |
| Intelligence | Business intelligence, reporting, forecasting, AI-assisted analytics | Reporting module, AI analytics service |
| Infrastructure | Authentication, authorization, database, audit logs, security, notifications, integrations | Auth module, authorization guard, Prisma, audit logs |

**Recommended starting shape:** one React application, one NestJS REST API, one PostgreSQL database. Enforce tenant isolation at every relevant data-access boundary. Build a modular monolith rather than introducing microservices prematurely.

## Business types supported

| Business type | Description |
|---|---|
| `RETAIL` | General retail shops |
| `PHARMACY` | Pharmacy branches with batch/expiry/prescription workflows |
| `HYBRID` | Retail products alongside regulated health products |

## Documentation map

```
README.md                                       <- You are here
documentations/
├── AGENTS.md                                    <- AI-agent instruction set
├── SaaS-Multi-Tenant-POS-Platform-Requirement.md <- Authoritative blueprint
├── project-tracking.md                           <- Project delivery tracker
├── production-readiness-roadmap.md                <- Full-scope delivery matrix and release gates
├── traceability.csv                             <- Requirement traceability matrix
├── implementation-baseline.md                   <- Implementation baseline
├── app-features.md                              <- Platform feature catalogue
├── development-phase.md                         <- Execution roadmap
├── docs/
│   ├── developer/                               <- Human developer onboarding kit
│   ├── scaffolding/                             <- Module structure & conventions
│   └── devtools/                                <- Development tooling inventory
└── pos-documentation-plan.md                   <- Planning record

.kilo/
├── agent/                                      <- Specialized agent skills
├── command/                                    <- Reusable agent commands
└── mcp/                                        <- MCP server declarations
```

## Quick orientation

- **Humans starting out** → [developer onboarding](documentations/docs/developer/onboarding.md)
- **AI agents working on this codebase** → [documentations/AGENTS.md](documentations/AGENTS.md), then [`.kilo/agent/`](.kilo/agent/)
- **Want to know how a module should be structured** → [scaffolding overview](documentations/docs/scaffolding/overview.md)

## Core principles (non-negotiable)

1. **Tenant isolation is enforced at every data-access boundary.** Never trust `tenant_id` from a request; derive or verify it from authenticated membership and the requested resource.
2. **Subscription entitlements are checked server-side** via a centralized `EntitlementService`. Never enforce limits only in React.
3. **Hiding a menu item is not security.** The API must enforce the same restrictions the UI implies.
4. **Prices, taxes, and totals are computed server-side.** Never trust frontend-supplied values.
5. **A completed POS sale is a single database transaction.** No partial state (sale without payment, or stock updated without sale).
6. **Pharmacy batch-level stock is first-class.** FEFO allocation, expiry validation, no expired-stock sales.
7. **AI is advisory only.** Approved analytical operations only; no raw SQL from natural language.
8. **Every sensitive action is audited.** No stack traces in production errors.
9. **Empty states support a genuinely empty database.** No fabricated business data to make dashboards look populated.

## Stack summary

**Frontend:** React.js, TypeScript, Vite, React Router, CSS variables for design tokens (per SEC-DS-001), semantic component library (Button, Input, Card, Badge, LoadingState, EmptyState, ErrorState, ForbiddenState).

**Backend:** NestJS, TypeScript, REST API, PostgreSQL, Joi validation, Helmet, Argon2id, JWT, structured logging, and job-processing foundations. OpenAPI route generation and development Swagger UI are available; request/response schemas and complete session hardening remain unfinished.

**Infrastructure:** Node.js 24, GitHub Actions CI, a locally installed PostgreSQL server, Prisma migrations, and background-job foundations. A production deployment pipeline is not established.

## Implementation status

The full-system release scope is not complete. This phase summary supersedes historical completion claims; detailed evidence and acceptance criteria are tracked in the [production-readiness roadmap](documentations/production-readiness-roadmap.md).

| Phase | Focus | Current status |
|---|---|---|
| 1 | Requirements and architecture | Blueprint exists; key product and regulatory decisions remain open |
| 2 | Application foundation | Partial; API response schemas, backend-integrated end-to-end coverage, and remote CI verification remain |
| 3 | Identity, tenancy, and authorization | Partial; workflows, admin UI, and end-to-end security evidence remain |
| 4 | Subscription and entitlement engine | Partial; complete payment lifecycle and concurrency acceptance remain |
| 5 | Core retail operations | Partial; several workflows/UI surfaces and financial rules remain |
| 6 | Pharmacy modules | Partial; regulatory decisions, UI, and passing workflow tests remain |
| 7 | Business intelligence and reporting | Partial; metrics, exports, margin, platform BI, and UI verification remain |
| 8 | AI analytics | Partial; forecasting/replenishment and full evaluation/privacy evidence remain |

### Existing implementation

The API contains modules for authentication, tenancy, authorization, subscriptions, products, inventory, stores, purchasing, sales, cash sessions, returns, pharmacy, reporting, AI, platform administration, campaigns, and jobs. The web app has a design system, shared layout, authentication pages, and selected feature pages. Presence of a module does not mean its complete workflow, authorization, UI, or operational behavior is accepted; consult the roadmap before relying on any capability.

## License and feedback

This project is under active development and is not production-ready. Feedback on the architecture should reference the section numbers in the [authoritative requirements blueprint](documentations/SaaS-Multi-Tenant-POS-Platform-Requirement.md).
