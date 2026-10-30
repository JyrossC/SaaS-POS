# Database Conventions

This document defines how the persistence layer and data model should be structured for the multi-tenant SaaS POS platform.

## Database defaults

- PostgreSQL as the primary database
- Prisma or comparable schema tooling
- Tenant-aware data ownership on operational tables
- Database-level integrity constraints beyond application checks
- Explicit support for store-scoped access and product-to-tenant integrity

## Tenant-scoped data design

Most business tables should include tenant ownership directly or through a validated relationship.

Example:

```sql
products (
  id,
  tenant_id,
  sku,
  name,
  base_unit,
  selling_price,
  created_at,
  updated_at
)
```

And:

```sql
inventory_balances (
  id,
  tenant_id,
  store_id,
  product_id,
  quantity_on_hand,
  quantity_reserved,
  updated_at
)
```

Database constraints must ensure that related rows remain in the same tenant.

## Required integrity rules

- primary keys and foreign keys
- tenant-scoped unique SKU rules where appropriate
- unique role names within a tenant scope
- valid monetary and quantity constraints
- allowed transaction state transitions
- idempotency keys for retriable actions
- consistent timestamps and audit trail fields

## Key design principles

- Avoid creating uniqueness constraints that block legitimate business workflows.
- Favor tenant-scoped uniqueness over global uniqueness when appropriate.
- Keep product names and descriptions as real user-entered data, subject to defined normalization rules.
- Use database-level constraints to prevent accidental cross-tenant linkage.

## Data cleaning and validation

Validation should follow a sequence like:

1. normalize allowed whitespace and text
2. trim fields as specified by schema rules
3. validate required fields and formats
4. normalize identifiers such as barcodes when required
5. validate money and quantities
6. enforce business rules
7. verify tenant ownership and permission
8. persist valid data
9. record relevant audit events

Data cleaning is not the same as arbitrary destructive normalization. Preserve legitimate user-entered content except where the format is explicitly defined.

## Recommended schema domains

```text
Identity and tenancy
- users
- tenants
- tenant_memberships
- stores
- membership_store_scopes

Authorization
- roles
- permissions
- role_permissions
- membership_roles
- access_policies
- audit_logs

Subscription and billing
- subscription_plans
- subscription_plan_versions
- plan_entitlements
- tenant_subscriptions
- subscription_invoices
- subscription_payments

Catalogue and inventory
- products
- product_categories
- product_units
- product_barcodes
- product_prices
- inventory_balances
- stock_movements
- stock_transfers
- stock_count_records

Purchasing
- suppliers
- purchase_orders
- purchase_order_items
- goods_receipts
- goods_receipt_items

Sales and payments
- sales
- sale_items
- sale_payments
- payment_transactions
- refunds
- cash_sessions
- cash_movements

Pharmacy
- drug_details
- product_batches
- batch_inventory
- prescriptions
- prescription_items
- dispensing_records
- dispensing_items
- stock_quarantine_records

Governance
- notifications
- report_exports
- integration_events
- background_jobs
```

## Pharmacy-specific database requirements

- Batch-level stock and expiry tracking should be first-class, not an implied attribute.
- FEFO and expiry checks must be represented in the data model and service logic.
- Dispensing and prescription data should maintain traceability across sales and returns.
- Quarantine and expiry flags should be persistent and auditable.

## Migration rules

- Use migration scripts for every schema change.
- Never modify a migration after it is released in an environment.
- Validate migrations during CI and deployment.
- Ensure tenant boundaries are part of migration review.

## Testing expectations

Database-related work should include tests that verify:

- unauthorized tenant relationships are blocked
- stock and invoice state are consistent after sales
- concurrent writes respect invariant checks
- pharmacy defaults and expiry logic hold under edge conditions
