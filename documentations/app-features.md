# Application Feature Catalogue

This catalogue describes the full target scope, not a claim that every feature is implemented or release-ready. The [production-readiness roadmap](production-readiness-roadmap.md) is the source of truth for current evidence, workstream ownership, dependencies, acceptance criteria, and release status.

## Full-system scope

| Domain | Required capabilities | Current evidence summary | Roadmap |
|---|---|---|---|
| Platform administration | Platform operators, tenant onboarding/review/suspension, plans, entitlements, billing oversight, support controls, audit, platform analytics | Auth, installation, KYB, and provider configuration code exists; complete lifecycle and admin UI are not established | R2, R3, R6 |
| Tenant administration | Business configuration, stores, staff/memberships, roles/permissions, settings, subscription/limits, tenant audit | Business profile settings are audited and permission-guarded. Configuration-only Mainland/Zanzibar provider setup, encrypted credential fields, tenant fiscal profiles, and add-on inquiries are implemented; no tax calculation, fiscal receipt, provider call, or add-on billing is active. Legal/provider approval and full fiscal workflows remain gated | R2, R3 |
| Retail catalog | Products, categories/units, identifiers/barcodes, price/tax configuration, archive/status | Product APIs/schema exist; broader catalog rules and end-to-end UI are incomplete or unverified | R4.1 |
| Inventory and purchasing | Balances, counts/adjustments, transfers, movements, suppliers, purchase orders, receipts, supplier returns, costing | Stock adjustment and purchasing services exist; complete count/transfer/return/cost workflows are not established | R4.2, R4.3, R4.10 |
| POS, payments, and cash | Cart/checkout, server-side totals, discounts, payment, receipts, cash sessions/movements, voids, refunds | Transactional sale and cash-session services exist; financial rules, receipt/UI coverage, idempotency, and reconciliation remain | R4.4–R4.6, R4.9 |
| Customers and promotions | Customer records/history/consent, campaigns, segments, eligibility and limits | Campaign code exists; a complete customer workflow and promotion acceptance are not established | R4.7, R4.8 |
| Pharmacy | Drug catalogue, batches, expiry/FEFO, prescriptions, dispensing, quarantine, return/recall, pharmacy reports | Batch/FEFO/dispensing service code exists; UI, regulatory rules, and passing workflow tests remain | R5 |
| Business intelligence | Sales, inventory, store/platform metrics, costing/margin, risk/expiry reports, CSV/PDF exports | Several report endpoints and charts exist; hard-coded UI deltas, margin, exports, platform BI, and metric reconciliation remain | R6.1–R6.3, R6.5 |
| AI-assisted analysis | Scoped read-only analysis, explanations, forecasting, replenishment recommendations, evaluation and privacy boundaries | Rule-based analytical query classification exists; forecasts and recommendations are not implemented | R6.4 |
| Cross-cutting platform | Tenant/store authorization, audit, notifications, integrations, jobs, offline POS/sync, monitoring and recovery | Foundations exist in some areas; end-to-end security, delivery, offline operation, and production evidence remain | R2.7–R2.8, R7, R8 |

## Status interpretation

- **Present in code** is not equivalent to a complete user workflow.
- **Documented** is not equivalent to implemented.
- **Implemented** is not equivalent to verified; completion requires measurable acceptance evidence.
- The full-system release includes offline capability and all other blueprint scope. No reduced pilot is implied.
- Product and regulatory decisions that affect acceptance criteria are recorded as blockers in the roadmap's decision register.

See the [authoritative requirements blueprint](SaaS-Multi-Tenant-POS-Platform-Requirement.md) for source requirements and the roadmap's [full-system release gates](production-readiness-roadmap.md) for shipment criteria.
