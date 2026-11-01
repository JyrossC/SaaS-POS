# Project Tracking

This is an evidence-based project status snapshot for the SaaS Multi-Tenant POS Platform. The full-system release remains incomplete. The [production-readiness roadmap](production-readiness-roadmap.md) is the authoritative delivery matrix with scope, dependencies, accountable workstreams, acceptance criteria, and release gates.

## 1. Current status

| Workstream | Status | Evidence / next gate |
|---|---|---|
| Requirements and architecture | Partial | Blueprint exists; launch, financial, billing, offline, and pharmacy decisions remain open. |
| Documentation and tracking | In progress | Onboarding reflects Node 24 and native PostgreSQL; an isolated Node 24 clean checkout passed through API/web HTTP smoke checks. Remote CI and dependency-audit remediation remain open. Use the roadmap for current acceptance status. |
| Application implementation | Partial | Substantial API code exists, but complete workflows, UI coverage, and end-to-end acceptance are not established. |
| Web/API build and quality | Passing locally / incomplete for release | Node 24 clean-copy typecheck, lint, builds, and tests pass; web bundle has a non-blocking chunk-size warning; OpenAPI covers 79 paths / 99 operations and all 40 request bodies, but only 12 operations have explicit response schemas. |
| API automated tests | Passing locally | 18 suites and 88 tests pass against a fresh isolated `_test` database, including HTTP integration coverage; remote CI remains unverified. |
| Web browser smoke tests | Passing locally | Six Playwright tests pass with mocked API responses; full backend-integrated business-flow browser acceptance remains outstanding. |
| Database migrations | Verified locally / CI pending | All 16 migrations applied to a newly created disposable PostgreSQL database under Node 24; Prisma reports status up to date. CI now provisions native PostgreSQL and checks status after deployment; remote CI remains unverified. |
| Production deployment and operations | Not verified | CI uses native PostgreSQL and application build artifacts; production deployment, monitoring, restore drills, and release rollback require evidence. |

This snapshot reflects observed repository and command evidence, not a claim that every behavior has been audited. Update it when reproducible evidence changes.

## 2. Project objectives

The full release target is a multi-tenant SaaS commerce system supporting retail and pharmacy operations, platform and tenant administration, subscription billing, business intelligence, AI-assisted analysis, and approved offline operation. No feature area is removed from scope to accelerate release.

## 3. Non-negotiable implementation constraints

1. Derive and verify tenant and store access from authenticated context; never trust request-supplied tenant identifiers.
2. Enforce subscription entitlements and resource limits server-side and atomically.
3. Calculate prices, taxes, and totals on the server according to approved product rules.
4. Persist a sale, payment, stock movement, and required audit data consistently.
5. Enforce pharmacy batch, expiry, authorization, and traceability rules.
6. Do not fabricate operational data for dashboards or reports.
7. Audit sensitive operations and do not expose secrets or stack traces in production errors.
8. Offline operation must follow approved payment, stock, synchronization, and security policies.

These are requirements, not assertions that the current implementation meets them.

## 4. Delivery sequence

1. **R0 — Engineering foundation:** restore reproducible build, test, lint, API docs, and migration verification.
2. **R1 — Product decisions:** settle market, financial, billing, offline, and pharmacy rules.
3. **R2 — Identity and administration:** complete tenant/platform administration, authorization, audit, and security workflows.
4. **R3 — Subscription and payments:** complete plan, entitlement, invoicing, provider, settlement, retry, refund, and reconciliation lifecycles.
5. **R4 — Retail operations:** complete catalog, inventory, purchasing, POS, cash, returns, customers, promotions, and receipts.
6. **R5 — Pharmacy:** complete regulated batch, prescription, dispensing, return, quarantine, recall, and reporting workflows.
7. **R6 — BI and AI:** complete verified metrics, exports, platform reporting, forecasting/replenishment, and privacy controls.
8. **R7 — Integrations and offline:** complete background processing, notifications, payment integrations, and offline synchronization.
9. **R8 — Production release:** prove deployment, observability, security, performance, backup/restore, rollback, and full-system acceptance.

Workstreams may proceed in parallel where their dependencies permit. The order does not reduce release scope.

## 5. Release decision

The release decision is the complete system with all scoped features. A release must remain blocked until every roadmap gate passes; individual phases or code modules must not be reported as complete based only on files or endpoints existing.
