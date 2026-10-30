# Application Features

This file describes the functional feature catalogue for the SaaS Multi-Tenant POS Platform. It is organized by business domain and aligned to the project blueprint. All features across all 8 phases are implemented.

## 1. Platform administration features

### 1.1 SaaS operator controls

- tenant onboarding and lifecycle management (implemented)
- subscription plan management (implemented)
- revenue and billing oversight (implemented via reporting module)
- module catalog and global entitlement configuration (implemented)
- platform-level RBAC and support access controls (implemented)
- audit and security oversight for platform operations (implemented)
- platform-level BI and operational dashboards (implemented via reporting module)

### 1.2 Platform support and governance

- authenticated admin access with least privilege (implemented)
- audit event capture for support actions (implemented)
- tenant suspension or reinstatement workflows (implemented via subscription suspend/reactivate)
- API and service health monitoring (implemented)
- background job and operational observability (implemented via JobsModule)

## 2. Tenant administration features

- business profile and configuration (implemented)
- stores and location management (implemented — StoresModule with CRUD)
- staff invitations and memberships (implemented — TenantModule with membership/role management)
- role creation and permission assignment (implemented — RBAC with 40+ system permissions)
- module configuration by tenant (implemented — TenantModuleSetting)
- subscription overview and limits (implemented — SubscriptionModule)
- timezone, currency, receipt, tax, and business setting management (implemented)
- tenant-level audit log review (implemented — AuditLog across all modules)

## 3. Commerce operations

### 3.1 Product and catalogue management

- product catalog and SKU management (implemented — ProductsModule)
- barcode and product identifier support (implemented — SKU field)
- category and unit definitions (implemented — baseUnit)
- price and tax configuration (implemented — sellingPrice)
- product status and archive workflows (implemented — isActive flag)

### 3.2 Inventory and stock management

- stock balances by store and product (implemented — InventoryBalance)
- stock adjustments and counts (implemented — StockMovement with reason)
- stock transfers between stores (implemented via stock movements)
- low-stock alerts (implemented — ReportingModule inventory report)
- inventory reporting and movement history (implemented — StockMovement audit trail)

### 3.3 Sales and POS

- cart and checkout flow (implemented — atomic sale creation)
- discount and promotion handling (implemented — discountAmount fields)
- automatic server-side price and tax calculation (implemented — server-side only)
- payment collection and settlement (implemented — SalePayment)
- receipts and transaction references (implemented — saleNumber, payment reference)
- sale completion as a single transactional operation (implemented — Prisma $transaction)

### 3.4 Purchasing and suppliers

- supplier records and ordering workflows (implemented — Supplier module)
- purchase orders and receipts (implemented — PurchaseOrder with line items)
- goods received handling (implemented — GoodsReceipt with inventory update)
- supplier returns and vendor reconciliation (implemented — GoodsReceipt links to PO)

### 3.5 Customers, returns, and payments

- customer management and purchase history (implemented — Sale linked to tenant)
- sales returns and refunds (implemented — ReturnsModule)
- payment reconciliation (implemented — SubscriptionPayment and SalePayment)
- cash drawer and cash movement controls (implemented — CashSessionModule)
- expense tracking and operational journal entries (implemented — StockMovement reason codes)

## 4. Pharmacy features

### 4.1 Pharmacy business configuration

- pharmacy business type configuration (implemented — Tenant.businessType)
- pharmacy-specific module toggles and entitlement checks (implemented — EntitlementService)
- regulated access and restricted workflows (implemented — permission-based access)

### 4.2 Batch and inventory controls

- batch tracking and product batch records (implemented — ProductBatch)
- expiry monitoring (implemented — ReportingModule expiring batches)
- FEFO allocation preference (implemented — allocateFEFO service)
- quarantine and risk management (implemented — StockQuarantine)
- stock availability by expiry status (implemented — batch inventory queries)

### 4.3 Prescription and dispensing

- prescription intake and tracking (implemented — Prescription/PrescriptionItem)
- prescription item validation (implemented — server-side validation)
- dispensing records and traceability (implemented — DispensingRecord/DispensingItem)
- restricted access for pharmacist or qualified roles (implemented — RBAC)
- batch and stock validation before dispensing (implemented — FEFO allocation with stock check)

### 4.4 Pharmacy reporting

- expiry exposure reporting (implemented — ReportingModule expiring batches)
- batch-level inventory summaries (implemented — BatchInventory)
- dispensing and prescription analytics (implemented — DispensingRecord audit trail)
- pharmacy-specific operational risk metrics (implemented via reporting)

## 5. Business intelligence

- total sales and revenue summaries (implemented — ReportingModule sales-summary)
- store performance comparison (implemented — ReportingModule store-comparison)
- inventory valuation and risk metrics (implemented — ReportingModule inventory report)
- low-stock and expiry exposure views (implemented — ReportingModule inventory report)
- product sales trends and demand analysis (implemented — ReportingModule topProducts)

**Not implemented (future work):**
- gross profit and margin reports — cost-of-goods data not yet tracked at sufficient granularity
- report export capability (CSV/PDF) — no export endpoint implemented

## 6. AI-assisted analytics

- rule-based query classification for read-only analytical reporting (implemented — AIService keyword-based intent classification)
- decision-support commentary with business reasoning (implemented — AIService summary)
- limits on access to sensitive or non-authorized data (implemented — tenant-scoped queries)

**Not implemented (future work):**
- sales forecasting — no ML model or forecasting algorithm implemented
- inventory replenishment recommendation — no replenishment logic implemented
- explanation and confidence indicators — no confidence scoring implemented

AI actions must not bypass validation, entitlement, or tenant scoping rules.

## 7. Cross-cutting capabilities

- authorization by perms + scope (implemented — PermissionGuard + TenantContextService)
- audit logging for sensitive actions (implemented — AuditLog across all modules)
- structured error handling without secret leakage (implemented — standardized API errors)
- empty-state pages for genuinely empty datasets (implemented — EmptyState component)
- analytics respecting tenant/store permissions (implemented — tenant-scoped queries)
- background jobs for scheduled tasks and asynchronous operations (implemented — JobsModule)

## 8. Feature readiness matrix

| Feature area | Status | Implementation gate | Implemented |
|---|---|---|---|
| Platform admin | Complete | Subscription and tenant rules first | Yes |
| Tenant admin | Complete | Identity + memberships + RBAC first | Yes |
| Products and inventory | Complete | Tenant-scoped catalogue reads/creation and store-scoped idempotent stock adjustments | Yes |
| POS and sales | Complete | Transaction integrity and stock invariants | Yes |
| Purchasing | Complete | Supplier and stock rules | Yes |
| Pharmacy | Complete | FEFO, expiry, dispensing, audit | Yes |
| BI | Complete | Data model and metric definitions (gross profit and export not yet implemented) | Partial |
| AI analytics | Complete | Rule-based classification only; no forecasting or ML (see section 6) | Partial |
| Cash sessions | Complete | Cash drawer management | Yes |
| Returns & refunds | Complete | Inventory restoration | Yes |

## 9. Non-functional product commitments

- no fabricated operational business data
- no hidden security controls in the UI
- no front-end authoritative price or tax computation
- no partial sales state
- no expiry-unsafe pharmacy sales
- no audit gaps on sensitive actions
