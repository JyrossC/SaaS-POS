# Full-System Production Readiness Roadmap

**Scope:** Full SaaS POS platform for retail, pharmacy, platform administration, reporting, AI-assisted analysis, and offline operation. This is the complete release target, not a reduced pilot.

**Status convention**

- **Partial** — relevant code or documentation exists, but the complete workflow and its acceptance evidence are not established.
- **Failing** — a configured verification command currently fails.
- **Not found** — no implementation was found in the inspected tracked code.
- **Needs decision** — implementation depends on an unresolved product, financial, or regulatory decision.
- **Not verified** — implementation may exist, but no adequate test or operational evidence was found.
- **Done** — may be used only when the acceptance criteria and release evidence are recorded.

Code being present is not sufficient for a workstream to be complete. Completion requires the API, persistence, authorization, UI, failure behavior, audit needs, tests, documentation, and operational handling appropriate to that capability.

## Baseline evidence

Reviewed against the tracked repository and configured commands on 2026-11-01.

| Check | Observed result |
|---|---|
| Web and API TypeScript checks | Pass |
| API production build | Pass |
| Web production build | Passes after fixing escaped utility selectors; Vite reports a non-blocking large-chunk warning |
| API Jest suite | Pass: 18 suites and 88 tests passed locally against a fresh dedicated `_test` database; destructive suites require a dedicated `_test` database. |
| Configured lint command | Web and API ESLint commands pass locally; web lint currently uses recommended rules with unused-variable checking disabled. |
| Web tests | Six Chromium Playwright smoke tests pass locally; auth, dashboard, and product API calls are mocked to prevent backend writes. |
| API documentation scripts | OpenAPI generation and a development-only Swagger UI are implemented; the generated spec covers 79 paths and 99 operations, including bearer-auth requirements. All 40 request bodies are documented (21 from Joi validation schemas, 19 from declared TypeScript inputs); 12 operations have explicit response schemas. Most response contracts remain undocumented, and CI generation has not yet been observed remotely. |
| Database migration deployment state | Pass locally: all 16 migrations applied successfully to a newly created disposable PostgreSQL database; Prisma migration status reports up to date. CI now runs migration status after deploy, but remote execution remains unverified. |
| E2E and CI full release path | Six browser checks still mock the API; one API test now exercises an actual HTTP login failure and persisted audit event through Nest and PostgreSQL. Broader successful business-flow E2E and remote CI remain unverified. |

These are a baseline snapshot, not a complete audit of every behavior. Update this table only with reproducible command output or environment evidence.

## Delivery order and dependency graph

1. **R0 — Verification and reproducible development foundation.** Unblocks reliable work and release evidence.
2. **R1 — Product, finance, and regulatory decisions.** Unblocks data semantics, billing, tax, accounting, and pharmacy acceptance criteria.
3. **R2 — Identity, platform/tenant administration, authorization, and audit.** Required before safely exposing operational and administrative features.
4. **R3 — Subscription lifecycle and payment integrations.** Depends on R1 and R2; required for SaaS entitlement and billing release.
5. **R4 — Complete retail and commerce operations.** Depends on R0 and R2; selected monetary and inventory rules depend on R1.
6. **R5 — Complete pharmacy workflows.** Depends on R2, R4 inventory/sales primitives, and pharmacy regulatory decisions in R1.
7. **R6 — Complete BI, exports, and AI.** Depends on trusted R4/R5 data and approved metric/privacy definitions.
8. **R7 — Complete offline operation and synchronization.** Depends on stable online sales, payments, inventory, and conflict policies.
9. **R8 — Production operations, full-system verification, and release.** Depends on all release-scope workstreams.

Workstreams can proceed in parallel where their dependencies permit. The listed release order is a dependency order, not a requirement to use one person or one sprint per phase.

## Decision register

These decisions are part of completing the full requirements, not reasons to remove features from scope. Record the approved decision and its date before treating affected acceptance criteria as final.

| ID | Decision needed | Accountable role | Blocks or changes |
|---|---|---|---|
| D1 | Launch jurisdictions, currencies (including TZS if Tanzania is in scope), tax rules, receipt requirements, and timezone policy | Product owner + finance/legal | Pricing, invoices, receipts, reports, deployments |
| D2 | Inventory valuation and cost-of-goods policy; treatment of discounts, taxes, voids, refunds, and expenses in reports | Finance/product owner | Stock costing, gross profit/margin, reconciliation |
| D3 | Payment methods and providers, recurring billing availability, settlement/reconciliation rules, refunds, retries, grace periods, and cancellation | Product owner + finance | SaaS billing and sale-payment lifecycle |
| D4 | Pharmacy jurisdictions, medicine categories, prescription/controlled-drug rules, staff qualifications, privacy, retention, recall, and audit requirements | Pharmacy domain owner + legal/compliance | Pharmacy acceptance criteria, data model, offline restrictions |
| D5 | Offline transaction policy: allowed payment methods, offline stock/oversell limits, device trust, synchronization conflicts, and unsupported operations | Product owner + operations | Offline POS and synchronization |
| D6 | Customer identity, loyalty, consent, retention, and customer/segment behavior | Product owner + privacy owner | Customer, campaign, analytics capabilities |

## Requirement-level delivery matrix

Accountable roles identify the workstream responsible for driving acceptance; they are not assigned individuals. Dependencies refer to the R0–R8 sequence and decision IDs above.

### R0 — Engineering foundation and release verification

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R0.1 | Web CSS selector escaping fixed; an isolated Node 24 clean install, generated Prisma client, root TypeScript checks, and web/API production builds pass locally; remote CI remains unverified | Web engineering | — | Clean install, web/API typecheck and production builds all pass in CI and locally on the documented runtime. |
| R0.2 | Web lint and Playwright scripts are implemented; six mocked browser smoke tests pass; the 18-suite/88-test API suite passes against an isolated local test database | QA + web/API engineering | R0.1 | No placeholder quality scripts; all committed unit/integration suites run and pass; failures are actionable and fail CI. |
| R0.3 | Six browser smoke tests cover public navigation, auth forms, registration/login routing, dashboard, and products with mocked API calls. A new HTTP integration test exercises the real login controller, auth service, PostgreSQL audit write, and error response. Remote CI and full successful critical-business-flow E2E remain unverified. | QA | R0.1, R0.2 | CI runs backend-integrated critical-flow E2E, tenant-isolation, concurrency, and pharmacy suites against a disposable migrated database. |
| R0.4 | OpenAPI output is generated from 79 paths / 99 operations; bearer auth is represented on guarded routes; development Swagger UI and JSON endpoint return 200, and both are absent in production. All 40 request bodies have schemas (21 derived from Joi validation and 19 from declared TypeScript inputs); 12 operations have explicit response schemas. Automated Jest contract assertions now check route/body counts, schemas, optional-body metadata, auth schemes, and selected response shapes. Most response schemas remain incomplete, and remote CI has not yet been run. | API engineering | R0.1 | Generated OpenAPI spec is produced from actual routes, validates, is served in development, and matches request/response behavior. |
| R0.5 | Node 24.22.2/npm 11.20.0 clean-install verification passed with locally installed PostgreSQL: `npm ci`, Prisma 7 client generation/schema validation, all 16 migrations/status, seed, lint, typecheck, builds, six browser tests, 18 API suites/88 tests, deterministic OpenAPI generation, and development/production API HTTP checks. `npm audit --audit-level=high` reports zero high or critical findings (29 moderate, 4 low). Remote CI on the native-PostgreSQL workflow remains unverified. | DevEx | R0.1 | A new developer follows the docs from a clean checkout using Node 24 and locally installed PostgreSQL, reaching migrated, seeded, running API and web without undocumented steps; CI and supported-runtime evidence pass. |
| R0.6 | All 16 migrations applied to fresh disposable PostgreSQL databases using Node 24, including with a non-superuser database-owner role matching CI; Prisma reports current and schema/client generation passes. CI now installs PostgreSQL directly on the runner and checks migration status; remote CI and schema/client drift verification remain outstanding. | Database + DevOps | R0.1 | CI applies every migration to an empty PostgreSQL database; migration status is clean and schema/client generation match. |

### R1 — Product, financial, and regulatory decisions

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R1.1 | Blueprint §20 explicitly leaves market, tax, currency, costing, pricing, offline, billing, and pharmacy scope open | Product + domain owners | — | D1–D6 are approved and recorded; each affected workflow has versioned business rules and test cases. |
| R1.2 | Current product/sale models use a single selling price and zero tax in sale creation; no documented accounting policy | Finance + commerce | D1, D2 | A signed-off set of examples defines line price, discount, tax, cost, net sales, gross profit, and refund effects; calculation tests match it. |
| R1.3 | Pharmacy requirements need jurisdiction-specific validation | Pharmacy domain owner + legal/compliance | D4 | Each supported medicine category has approved dispensing, prescription, staff authorization, records, retention, and recall rules; compliance review is recorded. |

### R2 — Identity, platform/tenant administration, authorization, and audit

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R2.1 | Tenant/platform login, tenant registration, platform installation, and token revocation code exist; registration activates the tenant directly while platform approval expects pending review | Identity/platform engineering | R0, R1 | Registration, plan/trial assignment, KYB/review, approval/rejection, and activation follow one state machine; unauthorized activation is rejected in integration tests. |
| R2.2 | Password reset code returns a reset token from the API; no delivery/verification workflow is established | Identity engineering | R0 | Reset responses do not disclose tokens; single-use expiring links are delivered through a real provider and tested for enumeration, replay, and expiry. |
| R2.3 | Blueprint calls for verification, MFA/recovery, refresh/session management, deactivation, and privileged-account policy; current UI stores access token in localStorage | Identity + security | R1, R2.1 | Chosen browser session model, refresh/revocation, email verification, optional/policy-required MFA and recovery, account disablement, and abuse controls pass security tests. |
| R2.4 | Tenant context and permission guards exist; tenant roles are listed, but role/permission administration endpoints and UI are not established | Authorization engineering | R2.1 | Authorized tenant admins can create/update roles and assign permissions within their tenant; negative cross-tenant and privilege-escalation tests pass. |
| R2.5 | Platform admin authentication exists; broad platform tenant/plan/admin management UI and scoped support-access workflow are not established | Platform engineering | R2.1, R2.4 | Platform admins can manage platform-defined resources through guarded UI/API; tenant data access requires explicit scoped authorization and produces an immutable audit record. |
| R2.6 | Business profile, currency, tax, timezone, receipt, numbering, notifications, and integration settings are not present as a complete tenant settings workflow | Tenant platform engineering | R1, R2.1 | Each approved setting is persisted, permission-protected, validated, audited, and consumed by the relevant operational workflows. |
| R2.7 | Audit writes exist in multiple services; coverage, actor/context consistency, tamper controls, and tenant audit review are not demonstrated end to end | Security + domain teams | R2.1 | An audit coverage test maps every sensitive action to actor, tenant, resource, timestamp, request context, and relevant before/after data without secrets; unauthorized edits are prevented. |
| R2.8 | Store-scope checks and composite tenant constraints are present in parts of the code/schema; broad integration proof is absent | Security + database | R0, R2.1 | A route/resource matrix is tested against tenant A/B and store A/B across every endpoint, including list, detail, update, export, jobs, and platform access. |

### R3 — Subscription lifecycle and payments

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R3.1 | Plans, plan versions, entitlements, limits, and entitlement checks exist; plan administration and full lifecycle behavior are not established | Billing/platform engineering | R1, R2 | Platform admins can version plans and entitlements; tenants see correct usage/access; historical subscriptions retain their agreed terms. |
| R3.2 | Store/staff limit checks lock a tenant row, but checks and resource creation are separate service transactions, so the complete limit invariant needs verification | Billing + database | R3.1 | Concurrent requests at each configured limit never exceed the limit; the check and create/invitation are one atomic operation, proven by database concurrency tests. |
| R3.3 | Provider configuration and webhook handling exist; checkout, recurring schedule, provider state reconciliation, refunds, and retries are not proven complete | Payments engineering | D1, D3, R3.1 | Each supported provider has a tested sandbox lifecycle covering checkout, signature verification, idempotent callbacks, exact amount/currency matching, duplicate/out-of-order events, refunds, failures, retries, and reconciliation. |
| R3.4 | Subscription service can record payments and change status, but manual status changes may not be tied to verified settlement | Billing + payments | R3.3 | A paid plan becomes active only through approved verified settlement or documented free/trial policy; invoice, payment, subscription, and entitlement states reconcile transactionally. |
| R3.5 | Platform stats exist but platform BI and billing dashboards are not complete | Platform BI | R3.1, R3.3, R6 | Platform reporting reconciles invoice/payment records and exposes approved aggregate metrics without tenant transaction leakage. |

### R4 — Complete retail and commerce operations

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R4.1 | Store CRUD and product create/list/detail exist; store/product UI routes and full product update/archive, categories, units, barcodes, prices, and tax workflows are incomplete | Commerce engineering | R0, R2, R1 | Authorized users can manage catalog and stores end to end; identifiers, price history, taxes, and tenant uniqueness follow approved rules and are covered by API/UI tests. |
| R4.2 | Inventory list and idempotent stock adjustment exist; stock counts, transfer records/approval, full movement history, and guided inventory UI are absent or unverified | Inventory engineering | R4.1, R1 | Count/reconcile/transfer workflows preserve source and destination quantities atomically, prevent negative/duplicate movement, enforce store access, and produce traceable audit records. |
| R4.3 | Supplier, purchase order, approval, and goods receipt services exist; order lifecycle, partial receipts, PO linkage validation, supplier returns/reconciliation, and robust UI need completion | Purchasing engineering | R4.1, R4.2 | Draft/approve/receive/partial-receive/cancel/return states enforce legal transitions; receipts cannot exceed approved quantities; all stock/cost changes reconcile. |
| R4.4 | Sales backend has server-side price and transactional sale/payment/stock/audit logic; taxes are zero, cash-session coupling is absent, sale idempotency does not verify same-request payload, and sale UI allows client price editing | POS/payments engineering | R1, R4.1, R4.2 | Server ignores client prices/totals; computed taxes/discounts/payments match approved rules; same idempotency key with different payload conflicts; stock/payment/sale/audit commit or roll back together. |
| R4.5 | Returns/refunds backend restores inventory and limits quantity; sale UI and return UI are partial, and payment refund execution/reconciliation is not shown | Returns/payments engineering | R4.4, D2, D3 | Partial/full returns, duplicate/concurrent returns, pharmacy batch traceability, payment refund, sale status, and inventory restore reconcile atomically and are tested. |
| R4.6 | Cash sessions have open/close APIs; UI displays “No active session” and has a history flow; cash movements/expenses and session-to-sale policy are not complete | Cash management | R4.4, D2 | Open/close/current session and every cash movement reconcile to sales/refunds and variance; concurrent session open/close is safe; accessible UI shows actual state. |
| R4.7 | No complete customer entity/workflow was found; campaign segment code references customer management | Customer/CRM engineering | D6, R2 | Tenant-scoped customer create/update/search/history/consent/delete-or-retain behavior and campaign membership pass privacy, isolation, and UI tests. |
| R4.8 | Campaigns and segments exist in API/UI; complete promotion type behavior, audience eligibility, stackability, usage caps under concurrency, and configuration coverage need verification | Promotions engineering | R4.4, R4.7 | Every advertised campaign type/rule has server-side eligibility and discount tests; concurrent use caps cannot be exceeded; UI accurately reflects state and analytics. |
| R4.9 | Receipts and sale references are listed in docs but a receipt endpoint/rendering/printing flow is not established | POS frontend + API | R4.4, D1 | Every completed/void/refunded sale produces a reproducible receipt with approved legal/business fields, payment details, numbering, and secure reprint behavior. |
| R4.10 | Expenses, operational journals, and supplier returns are claimed in feature docs but no dedicated workflow/model was found for them | Accounting/purchasing | D1, D2, R4.3, R4.6 | Each required expense/return type has persisted source records, approvals where required, ledger/report treatment, audit, and reconciliation tests. |

### R5 — Pharmacy operations

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R5.1 | Drug metadata, batches, expiry checks, FEFO service, and batch stock are implemented; drug catalogue UI uses raw IDs and full regulatory controls are unverified | Pharmacy engineering | R2, R4.1, D4 | Staff can manage drug details and batch receipt through searchable UI; tenant/store ownership, required drug fields, expiry boundaries, and audit are tested. |
| R5.2 | Prescription and dispensing backend exists; dispensing UI is partial and creates prescriptions from manually entered IDs | Pharmacy engineering | R5.1, D4 | Prescription lifecycle, authorized prescriber/dispensing roles, partial dispensing, quantity bounds, cancellation, and traceability pass negative and positive integration tests. |
| R5.3 | FEFO allocation, expiry blocking, and quarantine service logic exist; FEFO-related suite currently fails setup because CampaignService is not provided to SalesService tests | QA + pharmacy engineering | R0.2, R5.1 | All batch allocation tests pass against PostgreSQL for ties, expiry-today, expired, quarantined, insufficient, and concurrent sales/dispensing; batch and aggregate balances remain equal. |
| R5.4 | Quarantine/release APIs exist; UI uses raw identifiers, release quantity state is not sent by its hook, and pharmacy return/recall workflow is not complete | Pharmacy engineering | R5.1, R5.3 | Quarantine/release is quantity-aware and authorized, expired stock cannot be inadvertently released for sale, recall and return states are auditable and traceable to batch. |
| R5.5 | Expiring-batch service exists; complete pharmacy-specific reports, legal records, and regulatory retention are not verified | Pharmacy reporting + compliance | R5.1, D4, R6 | Approved expiry/dispensing/recall reports reconcile to source records, obey store scope, retain required records, and pass regulatory/domain review. |

### R6 — Business intelligence, exports, and AI

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R6.1 | Sales summary, inventory report, and store comparison exist; platform BI, valuation, margin, cash/refund metrics, and metric validation are incomplete | BI + finance | R1, R4, R5 | Every approved metric has a formula and fixture-based tests; totals reconcile to source transactions for empty, normal, refund, tax, discount, and multi-store cases. |
| R6.2 | Report UI has trend/comparison charts but uses hard-coded “12%” and “8%” KPI comparisons; empty/error handling and scope behavior need correction | Web + BI | R6.1 | All displayed values derive from authorized API data; no fabricated deltas; filters, zero-data, errors, and per-store scope have browser tests. |
| R6.3 | Gross-profit/margin and CSV/PDF exports are explicitly unimplemented | BI + finance | D1, D2, R4, R5, R6.1 | Costing and margin values reconcile to the approved valuation policy; exports match filtered report data, are permission/scope checked, and handle large datasets safely. |
| R6.4 | AI query classification is rule-based and reports read-only data; no forecasting, recommendation, confidence/explanation, or anomaly system exists | Data/AI + product | D2, D4, D6, R6.1 | Each approved AI feature has documented model/data boundaries, scoped analytical inputs, validated output, limitations/explanation, privacy controls, and measurable evaluation cases. |
| R6.5 | Tenant reports have some store filtering; platform report/UI and broad scope verification are not established | Security + BI | R2.8, R3.5, R6.1 | Cross-tenant and cross-store test fixtures prove that every report, export, AI operation, and dashboard returns only authorized records and aggregates. |

### R7 — Integrations, notifications, background processing, and offline operation

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R7.1 | Job persistence and processor exist; email/report handlers only log payloads, and scheduling/claiming/recovery are not release-proven | Platform/DevOps | R0, R2 | Supported jobs have real handlers, atomic worker claims, bounded retries/backoff, dead-letter/replay behavior, idempotency, tenant scope, and operational metrics. |
| R7.2 | Notifications (low stock, expiry, unusual events) are listed in the blueprint but no end-user notification workflow was found | Notifications engineering | R4.2, R5.1, R7.1 | Configured events generate deduplicated, tenant-scoped notifications through enabled channels; delivery failure/retry/preferences are tested and auditable. |
| R7.3 | Payment provider configuration/webhook code exists; provider-specific sandbox and production operation is not verified | Integrations + DevOps | D3, R3.3 | Each supported integration passes provider sandbox certification/checklist, signature/replay tests, secret rotation, reconciliation, alerting, and failure recovery. |
| R7.4 | Blueprint §16 and traceability describe offline as future/documented; user has confirmed offline is part of full-system target | Offline POS + security | D5, R4.4, R4.6, R7.3 | POS supports approved offline workflows with encrypted local persistence, unique IDs, retry-safe sync, conflict resolution, uncertain-payment handling, device revocation, and no policy bypass; offline E2E and recovery tests pass. |
| R7.5 | Shared package has only a minimal package manifest; cross-app API/domain contracts are not established as a maintained typed contract | Architecture + API/web | R0, R2 | Shared contracts or generated API client are versioned and used by UI and API; contract tests catch incompatible changes. |

### R8 — Deployment, observability, and full-system release

| ID | Requirement / current evidence | Accountable | Depends on | Measurable acceptance |
|---|---|---|---|---|
| R8.1 | CI exists; production deployment pipeline, managed secret handling, and environment parity are not proven | DevOps | R0, R1 | Build versioned API and web release artifacts; deploy to staging from CI with managed secrets, TLS, restricted CORS, private persistent storage, least-privilege DB, and controlled migrations. |
| R8.2 | Health endpoint catches database failures and reports degraded; readiness/liveness distinction, alerts, and observability validation are incomplete | SRE/DevOps | R7.1, R8.1 | Liveness/readiness accurately reflect dependencies; logs/metrics/traces omit secrets and identify request/tenant safely; alert tests detect service, DB, job, and payment failures. |
| R8.3 | Runbook documents backups and incident steps; actual automated backup, restore drills, and recovery targets are not verified | SRE/DBA | R8.1 | Automated encrypted backups meet approved RPO/RTO; restore drill reconstructs a working deployment and verifies representative sale, inventory, audit, and billing data. |
| R8.4 | Performance, capacity, resilience, accessibility, and browser support evidence is not established | QA + SRE + web | R4–R7, R8.1 | Agreed load, latency, availability, accessibility, and browser targets are documented and pass repeatable tests at representative tenant/store/data volumes. |
| R8.5 | Project docs claim all phases complete, 49 tests passing, and production readiness despite failing tests/build and acknowledged future work | Product/engineering leads | R0–R8 | README, tracker, feature catalogue, phase plan, and runbooks match release evidence; every full-scope requirement is Done or the release is blocked. |

## Full-system release gates

The full system is not shippable until all gates pass:

1. **Requirements:** D1–D6 are resolved; every blueprint and feature-catalogue requirement has a matrix entry, owner, dependencies, and acceptance evidence.
2. **Build and CI:** clean install, generation, lint, typecheck, unit/integration/E2E, migration validation, and production builds pass on the release commit.
3. **Business workflows:** platform setup → tenant approval/subscription → tenant configuration/staff/roles → catalog and inventory → purchasing → sale/payment/receipt → cash close → refund/return → reports works through real UI and persists correctly.
4. **Pharmacy workflows:** batch receipt → prescription → dispensing → refund/return/quarantine/recall is tested with expiry, FEFO, concurrency, scope, and traceability cases.
5. **Security and integrity:** tenant/store isolation, role boundaries, entitlements, idempotency, audit coverage, payment verification, and failure rollback pass adversarial and concurrency tests.
6. **BI and AI:** formulas reconcile to fixtures; exports and AI respect authorization/privacy; advisory output cannot trigger prohibited operational actions.
7. **Offline:** offline-capable workflows synchronize safely after interruption and preserve the approved stock/payment/regulatory policies.
8. **Operations:** staging deployment, migration, secrets, monitoring, background jobs, backup/restore, incident response, and rollback are rehearsed and recorded.
9. **Documentation:** onboarding, operator/user docs, API contract, feature status, and production runbooks match the shipped build.

## Evidence and status maintenance

Update a row's status only with evidence linked to a test, specification, implementation reference, or operational record. Record the release commit and environment for deployment-specific evidence. Re-run affected acceptance tests when code, schema, policy, or configuration changes.

Primary scope sources:

- [Authoritative requirements blueprint](./SaaS-Multi-Tenant-POS-Platform-Requirement.md)
- [Application feature catalogue](./app-features.md)
- [Requirement traceability CSV](./traceability.csv)
- [Development phases](./development-phase.md)
- [Project tracking](./project-tracking.md)
