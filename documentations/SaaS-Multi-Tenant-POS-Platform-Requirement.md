# SaaS Multi-Tenant POS Platform — Architecture, Design & Development Blueprint

You're not building an ordinary Point of Sale (POS) application. You're building a **multi-tenant commerce management platform** that serves two business categories—retail shops and pharmacies—through a shared SaaS infrastructure, with subscription-controlled capabilities, tenant isolation, configurable authorization, business intelligence, and AI-assisted decision-making.

The biggest architectural mistake would be to start by building the POS screen, dashboard, or product management module. Those are only the visible parts of the system. The foundation must correctly handle tenant isolation, subscription entitlements, inventory integrity, authorization, and transaction consistency.

I'll structure this as a blueprint that can guide the application from architecture and database design through implementation, testing, and deployment.

---

# 1. Product Vision and System Identity

## 1.1 The proposed platform

The application should operate as a centralized SaaS platform where multiple independent businesses subscribe to use the same application.

Each business receives its own isolated operational environment, configuration, users, stores, products, transactions, and reports.

For example:

- A general retail business operates three shops.
- A pharmacy operates two pharmacy branches.
- Another business operates a single convenience store.
- The platform administrator manages subscriptions, packages, tenants, and platform-wide configurations.

All businesses use the same application, but their data and permissions remain appropriately isolated.

### Core architecture



The architecture should separate platform administration from tenant operations while maintaining a shared application codebase.

## 1.2 Recommended system structure

Organize the application into five major layers.

| Layer | Responsibility |
|---|---|
| Platform Management | SaaS administration, tenant management, subscriptions, billing, package configuration, platform analytics |
| Tenant Management | Business configuration, staff, roles, permissions, stores, operational settings |
| Commerce Operations | POS, products, sales, inventory, purchasing, customers, suppliers, returns |
| Intelligence | Business intelligence, reporting, forecasting, AI-assisted analytics |
| Infrastructure | Authentication, authorization, database, audit logs, security, notifications, integrations |

These layers are logical boundaries, not necessarily separate deployable applications. Start with a well-structured modular monolith rather than introducing microservices prematurely.

**My recommendation:** Build one React application, one NestJS REST API, and one PostgreSQL database initially. Enforce tenant isolation at every relevant data-access boundary.

This keeps deployment manageable while allowing individual modules to be extracted into services later if actual scaling requirements justify it.

---

# 2. Technology Stack and Architectural Decisions

Your proposed stack is appropriate, but several important technologies and engineering standards need to be added.

## 2.1 Frontend

| Technology | Purpose |
|---|---|
| React.js | User interface |
| TypeScript | Type safety |
| Vite | Development and production builds |
| React Router | Navigation and route protection |
| TanStack Query | Server state, caching, mutations, invalidation |
| React Hook Form | Form management |
| Joi | Frontend validation where useful |
| A consistent component library | Reusable interfaces |
| CSS variables | Centralized design tokens |
| Recharts or Apache ECharts | Analytics and BI visualizations |

Recommended additional frontend considerations:

- Responsive desktop, tablet, and mobile interfaces.
- Keyboard-friendly POS workflows.
- Accessible dialogs and forms.
- Centralized API client.
- Standardized loading, empty, success, and error states.
- Feature-based module organization.
- Permission-aware navigation.

Use a consistent component system rather than mixing unrelated component libraries.

For a premium visual direction, you can use a carefully customized component library instead of building every component from scratch.

## 2.2 Backend

| Technology | Purpose |
|---|---|
| NestJS | Application framework |
| TypeScript | Type safety |
| REST API | Communication interface |
| PostgreSQL | Persistent relational database |
| Joi | Request validation |
| Helmet | HTTP security headers |
| Argon2id | Password hashing |
| JWT or secure sessions | Authentication |
| OpenAPI/Swagger | API documentation |
| Database migration tooling | Controlled schema changes |
| Structured logging | Diagnostics and monitoring |
| Background job queue | Scheduled and asynchronous tasks |

### Important decision: Joi in NestJS

NestJS commonly uses `class-validator` with `class-transformer`, but Joi is also a viable choice.

However, don't assume that installing Joi automatically validates every request. You need an explicit integration strategy.

I recommend:

1. Define reusable Joi schemas for request bodies, query parameters, and route parameters.
2. Create a reusable validation pipe.
3. Configure strict unknown-field handling.
4. Convert validation failures into standardized API errors.
5. Keep database constraints as a second layer of protection.

Validation must happen on the server even when the frontend already validates the same data.

### Important decision: PostgreSQL data access

Choose a database access strategy before developing modules.

Two reasonable options are:

- **Prisma:** Productive TypeScript development, schema management, and migrations.
- **TypeORM:** NestJS-oriented entity modeling and repository patterns.

For this project, I would lean toward Prisma, provided you are comfortable handling PostgreSQL transactions and database-level constraints explicitly.

Do not depend on the ORM alone to enforce business-critical integrity.

## 2.3 Recommended production infrastructure

Plan for the following, even if some components are introduced later:

- Managed or properly administered PostgreSQL.
- Automated backups and recovery testing.
- Centralized application logging.
- Error monitoring.
- Secrets management.
- CI/CD pipeline.
- HTTPS.
- Database migration checks.
- Rate limiting.
- Scheduled background jobs.
- Email or SMS notification provider.
- Object storage for documents and exports.

Redis is optional initially. Introduce it when you have a clear requirement for caching, distributed rate limiting, or background jobs.

---

# 3. Multi-Tenant Architecture

This is the most important architectural decision in the project.

## 3.1 Define the hierarchy

Use a clear organizational model:

```text
SaaS Platform
│
├── Platform Administrators
│
├── Tenant A: Retail Business
│   ├── Subscription
│   ├── Enabled Modules
│   ├── Tenant Administrators
│   ├── Staff and Custom Roles
│   ├── Store 1
│   │   ├── Products
│   │   ├── Inventory
│   │   └── Sales
│   ├── Store 2
│   └── Store 3
│
├── Tenant B: Pharmacy Business
│   ├── Subscription
│   ├── Pharmacy Configuration
│   ├── Staff and Custom Roles
│   ├── Pharmacy Store 1
│   └── Pharmacy Store 2
│
└── Tenant C: Retail Business
    └── Store 1
```

A tenant represents the subscribing business, not an individual store.

This distinction matters because one business may own several stores, share some product information across them, and still require store-specific inventory and permissions.

## 3.2 Database isolation strategy

For the initial version, I recommend a **shared PostgreSQL database with shared tables and explicit tenant ownership**.

For example:

```text
tenants
stores
users
tenant_memberships
roles
permissions
products
inventory_balances
sales
sale_items
subscriptions
```

Most tenant-owned operational records should contain a `tenant_id`, either directly or through a rigorously enforced relationship.

For example:

```text
products
-------
id
tenant_id
sku
name
base_unit
selling_price
created_at
updated_at
```

And:

```text
inventory_balances
------------------
id
tenant_id
store_id
product_id
quantity_on_hand
quantity_reserved
updated_at
```

The database must ensure that a product referenced by an inventory balance belongs to the same tenant as that balance.

A simple application-level check is not sufficient as the only protection.

### Recommended isolation controls

Implement multiple layers:

1. Authenticate the user.
2. Resolve the user's active tenant membership.
3. Validate access to the requested store.
4. Scope database queries to the authorized tenant.
5. Enforce cross-tenant relationship constraints.
6. Use PostgreSQL Row-Level Security (RLS) where practical.
7. Test explicitly for cross-tenant access vulnerabilities.

Do not accept `tenant_id` from a request and trust it as proof of authorization.

The backend should derive or verify the tenant context from authenticated membership and the requested resource.

### Why not create a database per tenant immediately?

A separate database per tenant increases operational complexity, migrations, connection management, and backup coordination.

Consider it later for enterprise customers with contractual isolation requirements or exceptional regulatory needs.

For your first release, a shared database with rigorously enforced isolation is a reasonable choice.

---

# 4. Business Types: Retail Shop and Pharmacy

Your application should support both business categories without maintaining two separate codebases.

## 4.1 Use a configurable business type

Each tenant should have a business type such as:

```text
RETAIL
PHARMACY
HYBRID
```

The `HYBRID` option is useful for businesses that sell ordinary retail products alongside regulated health products.

The selected business type determines which configurations are available by default, but it should not be the only control over module access.

For example, a pharmacy might need ordinary retail features as well as pharmacy-specific inventory management.

## 4.2 Module access toggle

The tenant administrator should have a configuration interface such as:

**Business Configuration**

| Module | Status | Action |
|---|---|---|
| General POS | Enabled | Toggle |
| Product Management | Enabled | Toggle |
| Inventory Management | Enabled | Toggle |
| Pharmacy Management | Disabled | Toggle |
| Prescription Management | Disabled | Toggle |
| Purchasing | Enabled | Toggle |
| Customer Management | Enabled | Toggle |
| Accounting | Disabled | Toggle |
| Business Intelligence | Enabled | Toggle |
| AI Assistant | Disabled | Toggle |

However, a toggle must never be the only enforcement mechanism.

The effective availability of a feature should depend on multiple conditions.

For example:

```text
Feature available =
    Platform permits feature
    AND subscription includes feature
    AND tenant has enabled feature
    AND user has the required permission
    AND requested store is accessible
```

Not every condition applies identically to every feature, but this is a useful default authorization model.

A platform administrator can control which modules exist on the platform. A subscription determines which modules the tenant may use. The tenant administrator configures the modules available within those limits. User permissions determine who may operate them.

**Critical distinction:** Hiding a menu item is not security. The API must enforce the same restrictions.

---

# 5. Complete Module Catalogue

The following is the recommended module inventory for planning.

Not every module needs to be developed in the first release. The objective is to define the architecture and release boundaries before implementation begins.

## 5.1 Platform administration modules

These modules belong to the SaaS operator.

| Module | Key capabilities |
|---|---|
| Platform Dashboard | Platform-wide KPIs, tenant activity, revenue, subscription statistics |
| Tenant Management | Create, suspend, activate, and manage tenants |
| Subscription Plans | Configure packages, pricing, limits, and billing periods |
| Subscription Management | Assign plans, track status, manage renewals |
| Module Catalogue | Define available modules and feature entitlements |
| Platform User Management | Manage platform administrators and their privileges |
| Platform RBAC | Platform roles, permissions, and administrative scopes |
| Billing Management | Subscription invoices, payment records, reconciliation |
| System Configuration | Global settings and operational controls |
| Audit and Security | Administrative actions, security events, audit trails |
| Integration Management | Configure supported external providers |
| System Monitoring | API health, failures, background jobs, service status |
| Platform Reports | Revenue, tenant growth, subscription conversion, churn |

Platform administrators should have broad authority, but not an excuse to bypass audit trails.

For sensitive operations—such as changing billing records, accessing tenant data, or suspending businesses—record who acted, what changed, and when.

## 5.2 Tenant administration modules

Each tenant receives an isolated administration environment.

| Module | Key capabilities |
|---|---|
| Business Profile | Business name, address, contact information, branding |
| Store Management | Create stores, configure locations, manage store status |
| Staff Management | Invitations, membership, activation, deactivation |
| Roles and Permissions | Create roles, assign permissions, configure access |
| Module Configuration | Enable and configure entitled modules |
| Subscription Overview | View current plan, limits, usage, renewal |
| Business Settings | Currency, tax rules, receipt preferences, timezone |
| Numbering and Sequences | Receipt numbers, purchase orders, transaction references |
| Audit Logs | Review tenant-level user and configuration changes |
| Notification Settings | Configure operational notifications |
| Integrations | Configure supported tenant-level integrations |

Tenant administrators must not be able to modify platform-wide subscription definitions, other tenants, or global system settings.

They should be able to manage their own business within the limits of their subscription.

## 5.3 Core retail modules

| Module | Capabilities |
|---|---|
| POS | Checkout, cart, discounts, taxes, payments, receipts |
| Products | Product catalogue, SKU, barcode, categories |
| Inventory | Stock balances, adjustments, stock counts |
| Store Transfers | Transfer stock between authorized stores |
| Suppliers | Supplier records and contact management |
| Purchasing | Purchase orders, goods received, supplier returns |
| Customers | Customer profiles, purchase history |
| Sales Returns | Returns, refunds, exchanges |
| Discounts and Promotions | Controlled discounts, price rules |
| Payments | Cash, supported digital payments, payment reconciliation |
| Cash Management | Cash drawer opening, closing, movements |
| Expenses | Record business expenses |
| Reports | Sales, margins, inventory, cash movements |
| Notifications | Low stock, unusual transactions, operational alerts |

### POS transaction integrity

A completed sale should be a single coherent business transaction.

For example, completing a cash sale may require:

1. Validating the cart.
2. Validating product prices and applicable taxes.
3. Checking stock policy.
4. Calculating totals on the server.
5. Recording the sale.
6. Recording sale items and price snapshots.
7. Recording payment details.
8. Updating inventory.
9. Recording the relevant audit or stock movement entries.
10. Returning the receipt information.

These operations should be coordinated using a database transaction wherever they share a database.

If a critical operation fails, the system must not leave behind a completed sale with missing payment records or partially updated stock.

Do not trust prices, tax amounts, or final totals supplied by the frontend.

## 5.4 Pharmacy-specific modules

A pharmacy is not simply a retail shop with a different dashboard. Its product and inventory rules can be substantially different.

| Module | Capabilities |
|---|---|
| Drug Catalogue | Generic name, brand, strength, dosage form |
| Batch Management | Batch number, supplier batch references |
| Expiry Management | Expiry dates, near-expiry and expired-stock alerts |
| Batch-Level Inventory | Stock quantities and cost by batch |
| FEFO Stock Selection | First Expiry, First Out |
| Prescription Management | Prescription capture and appropriate validation |
| Dispensing | Dispensing records, quantities, authorized staff |
| Controlled Medicines | Restricted workflows and additional audit controls where applicable |
| Supplier Management | Supplier details and purchasing history |
| Returns and Quarantine | Returned, recalled, expired, or quarantined stock |
| Pharmacy Reports | Expiry exposure, dispensing activity, batch traceability |
| Regulatory Records | Configurable records and reporting for applicable requirements |

### Pharmacy-specific design requirements

**Batch-level stock must be a first-class concept.**

Consider a product with the same name and strength arriving in two batches:

- Batch A: 20 units, expires in January.
- Batch B: 100 units, expires in June.

The POS must know which units are sold from which batch.

A single product-level quantity cannot adequately support expiry tracking, batch traceability, and stock recalls.

Implement:

- Product and batch separation.
- Batch-specific quantities by store.
- Expiry date validation.
- FEFO allocation.
- Prevention of expired stock sales.
- Configurable low-stock and expiry alerts.
- Supplier and goods-received traceability.
- Controlled adjustments and write-offs.

Pharmacy requirements must also be validated against applicable Tanzanian pharmacy, medicines, prescription, privacy, and recordkeeping requirements before deployment.

Do not assume that one generic pharmacy workflow is legally appropriate for every medicine category.

---

# 6. Subscription Packages and Entitlements

This is the commercial engine of your SaaS platform.

Avoid implementing subscription limits using hardcoded checks scattered throughout the codebase.

Instead, create a centralized entitlement system.

## 6.1 Example package structure

These are illustrative packages, not proposed market prices.

| Feature | Starter | Growth | Business | Enterprise |
|---|---:|---:|---:|---:|
| Maximum stores | 1 | 3 | 10 | Configurable |
| Staff accounts | 3 | 10 | 30 | Configurable |
| POS | Yes | Yes | Yes | Yes |
| Product Management | Yes | Yes | Yes | Yes |
| Inventory | Basic | Advanced | Advanced | Advanced |
| Purchasing | Optional | Yes | Yes | Yes |
| Pharmacy Module | Optional | Optional | Optional | Configurable |
| Custom Roles | Limited | Yes | Yes | Yes |
| BI Dashboard | Basic | Standard | Advanced | Advanced |
| AI Analytics | No | Optional | Yes | Configurable |
| API Integrations | No | Limited | Yes | Custom |
| Audit History | Limited | Extended | Extended | Configurable |

A pharmacy module should be available only when the platform and the tenant's subscription permit it.

Do not assume that every pharmacy customer automatically needs the same paid tier. Design entitlements so the commercial model can evolve.

## 6.2 Data model

Consider these tables:

```text
subscription_plans
subscription_plan_versions
plan_entitlements
tenant_subscriptions
tenant_entitlement_overrides
subscription_invoices
subscription_payments
subscription_events
```

A plan version is useful because changing a package should not silently rewrite the commercial terms of every existing subscription.

A tenant subscription should reference the appropriate plan version and track its status and relevant billing dates.

Possible statuses include:

```text
TRIALING
ACTIVE
PAST_DUE
SUSPENDED
CANCELED
EXPIRED
```

Define exactly what each status permits.

For example, a past-due subscription might retain read-only access for a configured grace period, while a suspended subscription might prohibit sales. Those rules should be explicit business decisions rather than accidental side effects.

## 6.3 Entitlement enforcement

Create a centralized service:

```text
EntitlementService
├── canAccessModule()
├── canCreateStore()
├── canInviteStaff()
├── canUseFeature()
├── getUsage()
└── getPlanLimits()
```

Before creating a store:

```text
1. Authenticate the user.
2. Resolve the tenant.
3. Verify the required permission.
4. Verify subscription status.
5. Read the effective store limit.
6. Count stores using a concurrency-safe strategy.
7. Reject creation if the limit is exceeded.
8. Create the store.
9. Record the audit event.
```

The last few operations must be protected against race conditions.

For example, two administrators might attempt to create the final permitted store simultaneously. Both requests must not independently pass a limit check and exceed the package allowance.

Use appropriate database locking, transactional coordination, or another concurrency-safe enforcement strategy.

**Never enforce subscription limits only in React.**

---

# 7. RBAC and ABAC Authorization

You specifically need both systems.

They solve related but different problems.

## 7.1 RBAC: Role-Based Access Control

RBAC determines which permissions a user receives through their assigned roles.

Examples:

- Tenant Owner
- Tenant Administrator
- Store Manager
- Cashier
- Inventory Manager
- Pharmacist
- Purchasing Officer
- Accountant
- Auditor

These are useful default roles, but tenant administrators should be able to create additional roles when permitted by their plan and configuration.

A custom role might be:

```text
Role: Senior Cashier

Permissions:
- sales.create
- sales.read.own_store
- receipts.print
- customers.read
- discounts.apply_limited
```

A tenant administrator should be able to grant and revoke permissions without requiring a code change.

## 7.2 ABAC: Attribute-Based Access Control

ABAC evaluates attributes of the user, resource, action, and context.

Examples:

- A cashier can process sales only in assigned stores.
- A store manager can approve a refund only below an authorized threshold.
- A staff member can view a report only for permitted stores.
- A pharmacist can access certain dispensing workflows only when the relevant qualifications and authorization requirements are satisfied.
- A user cannot access records belonging to another tenant, regardless of their role name.

A useful authorization model is:

```text
Authorization decision =
    User identity
    + Tenant membership
    + Role permissions
    + Resource attributes
    + Store scope
    + Business policy
    + Subscription entitlements
```

## 7.3 Recommended authorization tables

```text
users
tenants
tenant_memberships
stores
membership_store_scopes

roles
permissions
role_permissions
membership_roles

access_policies
audit_logs
```

Use tenant-scoped roles where custom role definitions belong to individual businesses.

A global role definition can be used for carefully controlled system defaults, but tenant customization must not allow one tenant to modify another tenant's roles.

## 7.4 Permission naming convention

Use predictable, resource-oriented permissions:

```text
dashboard.view

products.view
products.create
products.update
products.archive

inventory.view
inventory.adjust
inventory.transfer
inventory.count

sales.view
sales.create
sales.void
sales.refund

purchases.view
purchases.create
purchases.approve

stores.view
stores.create
stores.update

staff.view
staff.invite
staff.update
staff.deactivate

roles.view
roles.create
roles.update
roles.assign_permissions

reports.view
reports.export

pharmacy.batches.view
pharmacy.batches.manage
pharmacy.dispensing.create
pharmacy.prescriptions.view

subscriptions.view
subscriptions.manage
```

These are examples, not an exhaustive final catalogue.

Keep permissions granular enough for security without creating thousands of overlapping permissions that administrators cannot understand.

### Critical distinction: permission versus scope

A permission answers:

**What can this user do?**

A scope answers:

**Where, to which records, and under what conditions can they do it?**

For example:

```text
Permission: sales.view
Scope: Store A
```

This should not automatically authorize access to sales from Store B.

Similarly, permission to issue refunds does not necessarily mean unlimited refund approval authority.

The backend must evaluate both permission and applicable policy.

## 7.5 Platform administrator versus tenant administrator

| Capability | Platform Administrator | Tenant Administrator |
|---|---|---|
| Manage tenants | Yes | No |
| Configure subscription plans | Yes | No |
| Suspend tenant subscriptions | Yes, subject to platform policy | No |
| Manage tenant staff | Platform-level oversight as authorized | Own tenant |
| Create custom tenant roles | Platform defaults and governance | Own tenant, within constraints |
| Manage stores | Authorized platform operations | Own tenant |
| Configure business modules | Set global availability and entitlements | Configure entitled modules |
| View business transactions | Restricted, audited support access where justified | Authorized tenant data |
| Manage platform settings | Yes | No |
| View tenant BI | Platform-level aggregates and authorized access | Own tenant |
| Override authorization | Controlled emergency procedures, audited | No unrestricted override |

One subtle but important point: **a platform administrator should not automatically browse every customer's transaction details without controls simply because the role is powerful.**

Use least privilege, audited support access, and clear separation between platform administration and customer operational data.

---

# 8. Database Design and Persistent Data

Your rule that data must remain empty until created is correct.

Do not confuse this with the prohibition on all initial database records.

A production system still needs foundational records such as system permissions, default subscription plans, and required configuration.

The correct principle is:

> No fabricated business data. Operational data must originate from legitimate user actions, authorized integrations, or explicitly documented data imports.

## 8.1 Recommended database domains

Organize the schema into logical domains.

### Identity and tenancy

```text
users
tenants
tenant_memberships
stores
membership_store_scopes
```

### Authorization

```text
roles
permissions
role_permissions
membership_roles
access_policies
```

### Subscription and billing

```text
subscription_plans
subscription_plan_versions
plan_entitlements
tenant_subscriptions
subscription_invoices
subscription_payments
```

### Catalogue and inventory

```text
products
product_categories
product_units
product_barcodes
product_prices
inventory_balances
stock_movements
stock_transfers
stock_transfer_items
stock_counts
```

### Purchasing

```text
suppliers
purchase_orders
purchase_order_items
goods_receipts
goods_receipt_items
supplier_returns
```

### Sales and payments

```text
sales
sale_items
sale_payments
payment_transactions
refunds
refund_items
cash_sessions
cash_movements
```

### Pharmacy

```text
drug_details
product_batches
batch_inventory
prescriptions
prescription_items
dispensing_records
dispensing_items
stock_quarantine_records
```

### Reporting and governance

```text
audit_logs
notifications
report_exports
integration_events
background_jobs
```

This is a starting point, not a final ERD. Some tables can be combined, split, or adjusted after detailed workflow analysis.

## 8.2 Important database constraints

At minimum, plan for:

- Primary keys.
- Foreign keys.
- Unique tenant-scoped SKU constraints.
- Unique tenant-scoped role names where required.
- Valid quantity and monetary constraints.
- Valid transaction states.
- Referential integrity.
- Appropriate indexes.
- Consistent timestamps.
- Database-level protection against cross-tenant relationships.
- Unique idempotency keys for operations that may be retried.

For example, a SKU may be unique within a tenant without being globally unique across all tenants.

A product name, however, usually does not need to be unique.

Avoid inventing uniqueness constraints that prevent legitimate business workflows.

## 8.3 Data cleaning and validation

Your requirement that data must be cleaned before storage should become an explicit validation pipeline.

For a product creation request:

1. Normalize permitted whitespace.
2. Trim appropriate text fields.
3. Validate required fields.
4. Normalize identifiers according to documented rules.
5. Validate monetary values and quantities.
6. Reject malformed values.
7. Enforce business rules.
8. Verify tenant ownership and permissions.
9. Persist valid data.
10. Record relevant audit information.

Do not indiscriminately lowercase names or remove characters from user-entered data.

Data cleaning must preserve legitimate information.

For example, preserve product names and descriptions as entered apart from clearly defined normalization rules. Normalize identifiers such as barcodes only according to the identifier's format.

**Validation, normalization, authorization, and business-rule enforcement are separate responsibilities.** Treating them as one generic sanitization step creates security and data-integrity problems.

---

# 9. Persistent Data Across All Pages

This requirement needs a consistent frontend architecture.

A successful product creation should not update only the product creation screen. The new product must appear in the product catalogue, POS search, inventory views, and relevant reports as appropriate.

## 9.1 Recommended data flow

```text
React Component
      │
      ▼
Form Validation
      │
      ▼
API Client
      │
      ▼
NestJS REST Endpoint
      │
      ▼
Authentication and Authorization
      │
      ▼
Joi Validation
      │
      ▼
Business Service
      │
      ▼
PostgreSQL Transaction
      │
      ▼
Persisted Data
      │
      ▼
API Response
      │
      ▼
TanStack Query Cache Invalidation
      │
      ▼
Updated Relevant Screens
```

PostgreSQL is the source of truth. React state and client-side caches are not substitutes for persistence.

## 9.2 Cache invalidation strategy

Suppose a user creates a product.

The application should invalidate or update relevant queries:

```text
products.list
products.detail
products.search
inventory.product_summary
dashboard.product_metrics
```

Only invalidate queries whose underlying data may have changed.

When a sale completes, relevant queries might include:

```text
sales.list
sales.detail
inventory.store_summary
inventory.product_balances
dashboard.sales_metrics
reports.sales_summary
cash.current_session
```

A query key should include all important scope dimensions, such as tenant, store, and filters, to avoid accidentally reusing data across different contexts.

Do not invalidate every query after every operation. That wastes resources and can make the interface feel slow.

For asynchronous processes, refresh the UI only when the authoritative data has reached the appropriate state.

## 9.3 Empty states

Every page should support a genuinely empty database.

Examples:

- No products have been added.
- No stores have been created.
- No sales have occurred.
- No suppliers have been registered.
- No reports are available for the selected period.

An empty state should explain what is missing and provide an appropriate action.

For example:

**No products yet**

"Create your first product to begin managing inventory and processing sales."

[Add Product]

Do not insert fictitious sales, products, customers, or inventory balances merely to make dashboards appear populated.

However, distinguish legitimate initial configuration from fabricated business data.

A tenant may have a default currency, timezone, required system permissions, and a configured first administrator without having any products or sales.

---

# 10. Premium UI/UX Design System

You requested a clean, crisp theme with luxury colors and fonts.

I recommend a restrained enterprise design rather than a visually crowded dashboard.

The application should feel premium through typography, spacing, alignment, consistent components, and information hierarchy—not through excessive gradients or decorative effects.

## 10.1 Recommended visual direction



### Suggested color palette

| Purpose | Color | Hex |
|---|---|---|
| Primary brand | Deep Burgundy | `#701C35` |
| Primary hover | Dark Burgundy | `#571429` |
| Main background | Soft Ivory | `#FAF9F6` |
| Card background | Pure White | `#FFFFFF` |
| Main text | Charcoal | `#24242B` |
| Secondary text | Slate Gray | `#6B7280` |
| Borders | Warm Gray | `#E7E2E3` |
| Success | Deep Green | `#18794E` |
| Warning | Amber | `#B7791F` |
| Danger | Crimson | `#C6283D` |
| Information | Deep Blue | `#2457A7` |

Use burgundy for brand identity and primary actions.

Use crimson for destructive actions, critical errors, dangerous alerts, and confirmation dialogs involving irreversible operations.

Do not make every warning crimson. Users need to distinguish danger from ordinary caution.

For destructive confirmations, use clear language such as:

> Delete this store? This action cannot be completed while the store has unresolved operational dependencies.

Where hard deletion is inappropriate, provide deactivation or archival instead.

## 10.2 Typography

Recommended combination:

- **Headings:** Manrope.
- **Body and UI:** Inter.
- **Financial figures and tabular data:** Inter with tabular numerals enabled.

Both fonts provide a modern enterprise aesthetic.

Use a limited set of font weights:

```text
Regular: 400
Medium: 500
Semibold: 600
Bold: 700
```

Avoid using too many different font families or weights. Consistency matters more than decorative variety.

## 10.3 Layout principles

Use:

- Fixed or collapsible sidebar.
- Clear page titles.
- Compact but readable tables.
- Consistent page gutters.
- Predictable modal sizes.
- Responsive layouts.
- Subtle borders and restrained shadows.
- Consistent form spacing.
- Clear primary and secondary actions.
- Accessible color contrast.
- Consistent empty and loading states.

A POS checkout screen should prioritize speed, visibility, keyboard navigation, and minimal interaction steps. It should not inherit every layout decision from the administrative dashboard.

## 10.4 Design tokens

Define tokens centrally rather than hardcoding colors throughout components.

```css
:root {
  --color-brand: #701c35;
  --color-brand-hover: #571429;

  --color-background: #faf9f6;
  --color-surface: #ffffff;

  --color-text-primary: #24242b;
  --color-text-secondary: #6b7280;

  --color-border: #e7e2e3;

  --color-success: #18794e;
  --color-warning: #b7791f;
  --color-danger: #c6283d;
  --color-info: #2457a7;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-card:
    0 2px 8px rgb(36 36 43 / 5%);
}
```

These tokens are the foundation of the design system. Component states, accessibility, and dark mode can be built on top of them later.

---

# 11. Business Intelligence Dashboard

Your BI dashboard should help business owners make decisions, not merely display attractive charts.

Separate operational dashboards from analytical dashboards.

Operational dashboards show what is happening now. BI dashboards help users understand patterns, performance, and potential actions.

## 11.1 Tenant dashboard

Recommended metrics:

| Metric | Purpose |
|---|---|
| Total Sales | Sales performance during the selected period |
| Gross Profit | Revenue less cost of goods sold, under the selected accounting policy |
| Gross Margin | Profitability percentage |
| Number of Transactions | Sales activity |
| Average Transaction Value | Average sales amount per transaction |
| Stock Valuation | Value of current inventory under the selected valuation method |
| Low-Stock Products | Replenishment priorities |
| Expiring Stock | Pharmacy-specific expiry exposure |
| Top-Selling Products | Product demand |
| Sales by Store | Compare branch performance |
| Sales Trends | Identify changes over time |
| Returns and Refunds | Track returned goods and refund activity |

All metrics must be calculated from real, persisted business data.

If no sales exist, the dashboard should show an empty state or a meaningful zero—not a fabricated sales chart.

## 11.2 Tenant scoping

The dashboard should respect:

- Tenant membership.
- Store access.
- User permissions.
- Subscription entitlements.
- Reporting restrictions.

For example, a store manager assigned to Store A must not see Store B's financial results merely because both stores belong to the same tenant.

Tenant administrators may be permitted to see all stores in their business.

## 11.3 Platform BI

The SaaS operator needs a separate dashboard with metrics such as:

- Active tenants.
- Trial-to-paid conversion.
- Subscription revenue.
- Monthly recurring revenue where applicable.
- Churn.
- Failed subscription payments.
- Package distribution.
- Feature adoption.
- Tenant growth.
- API reliability.

Keep platform analytics separate from tenant operational analytics.

Do not expose customer transaction details through platform-wide reports unless there is a justified, authorized, and audited business need.

## 11.4 Analytical correctness

BI metrics need documented definitions.

For example, revenue, gross sales, net sales, gross profit, cash collected, and outstanding receivables are not interchangeable.

A refund may affect net sales without having the same effect on every other metric. Taxes collected on behalf of authorities should not automatically be treated as revenue.

Define the calculation rules before building charts.

---

# 12. AI Integration

AI should be integrated where it provides measurable value.

Do not add a chatbot merely to claim the platform is AI-powered.

I recommend introducing AI in stages, beginning with read-only analytical assistance.

## 12.1 AI use cases

### A. Sales forecasting

Estimate future sales using historical transactions, seasonality, promotions, and other relevant data.

Potential output:

- Expected sales for the next seven days.
- Confidence intervals.
- Seasonal trends.
- An explanation of relevant assumptions.

### B. Inventory recommendations

Identify products that may need replenishment.

Inputs may include:

- Historical sales.
- Current stock.
- Supplier lead times.
- Minimum stock thresholds.
- Pending purchase orders.
- Expiry constraints.

A recommendation should explain its reasoning and allow a human to review it.

### C. Pharmacy expiry analysis

Identify batches at risk of expiring before expected sale or dispensing.

The analysis should account for:

- Batch quantities.
- Expiry dates.
- Historical demand.
- Legal restrictions.
- Stock transfer opportunities.

Never let an AI recommendation override a hard rule prohibiting the sale or dispensing of expired or otherwise prohibited stock.

### D. Business performance explanations

Allow authorized users to ask questions such as:

- Why did sales decline this month?
- Which stores have the lowest gross margins?
- Which products contribute most to profit?
- Which products may be overstocked?
- What are the main drivers of unusually high refunds?

The AI should use authorized, validated analytical data—not unrestricted access to raw database records.

### E. Anomaly detection

Identify unusual patterns, such as:

- Abnormal refund rates.
- Unexpected stock adjustments.
- Unusual discounts.
- Sudden increases in transaction voids.
- Significant deviations from normal sales patterns.

These should be treated as indicators for investigation, not automatic proof of misconduct.

## 12.2 Recommended AI architecture

```text
React Analytics Interface
          │
          ▼
NestJS AI Controller
          │
          ▼
Authentication and Authorization
          │
          ▼
Tenant and Store Scope Validation
          │
          ▼
Approved Analytics Service
          │
          ▼
Aggregated and Validated Data
          │
          ▼
AI Provider / Analytical Model
          │
          ▼
Structured Output Validation
          │
          ▼
Result + Explanation + Limitations
          │
          ▼
React Dashboard
```

The AI should not receive unrestricted database credentials.

It should not be allowed to execute arbitrary SQL generated from a natural-language request.

Instead, expose approved analytical operations and validate all parameters.

For example:

```text
getSalesSummary()
getProductPerformance()
getInventoryRisk()
getExpiryExposure()
getStoreComparison()
getRefundAnomalies()
```

Each operation must independently enforce authorization and tenant/store scope.

### Important privacy consideration

Commercial records, customer details, and pharmacy-related information may be sensitive.

Minimize the data sent to external AI providers, use appropriate contractual and privacy controls, and avoid sending patient-identifiable prescription information unless the relevant legal and security requirements have been satisfied.

AI-generated recommendations should remain advisory until a separately designed, tested, and authorized workflow allows an action to be taken.

---

# 13. REST API Design

Use consistent REST conventions and version the API from the beginning.

Recommended base path:

```text
/api/v1
```

## 13.1 Example endpoints

### Authentication

```http
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

### Platform administration

```http
GET    /api/v1/platform/tenants
POST   /api/v1/platform/tenants
GET    /api/v1/platform/tenants/:tenantId
PATCH  /api/v1/platform/tenants/:tenantId

GET    /api/v1/platform/subscription-plans
POST   /api/v1/platform/subscription-plans
PATCH  /api/v1/platform/subscription-plans/:planId
```

### Tenant administration

```http
GET    /api/v1/tenant/profile
PATCH  /api/v1/tenant/profile

GET    /api/v1/tenant/stores
POST   /api/v1/tenant/stores
PATCH  /api/v1/tenant/stores/:storeId

GET    /api/v1/tenant/staff
POST   /api/v1/tenant/staff/invitations

GET    /api/v1/tenant/roles
POST   /api/v1/tenant/roles
PATCH  /api/v1/tenant/roles/:roleId
```

### Products and inventory

```http
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:productId
PATCH  /api/v1/products/:productId

GET    /api/v1/stores/:storeId/inventory
POST   /api/v1/stores/:storeId/stock-adjustments

GET    /api/v1/stores/:storeId/stock-transfers
POST   /api/v1/stores/:storeId/stock-transfers
```

### POS

```http
POST   /api/v1/sales
GET    /api/v1/sales
GET    /api/v1/sales/:saleId

POST   /api/v1/sales/:saleId/refunds
GET    /api/v1/sales/:saleId/receipt
```

### Pharmacy

```http
GET    /api/v1/pharmacy/batches
POST   /api/v1/pharmacy/batches

GET    /api/v1/pharmacy/expiring-stock
GET    /api/v1/pharmacy/prescriptions
POST   /api/v1/pharmacy/prescriptions

POST   /api/v1/pharmacy/dispensing
```

### Analytics

```http
GET    /api/v1/analytics/overview
GET    /api/v1/analytics/sales-trends
GET    /api/v1/analytics/product-performance
GET    /api/v1/analytics/inventory-risk

POST   /api/v1/ai/analytics
```

These are illustrative contracts. Define the exact request and response schemas, status codes, pagination rules, and authorization requirements before implementing each endpoint.

---

# 14. Backend Architecture and Code Organization

Use a modular monolith with clear domain boundaries.

Suggested structure:

```text
apps/
├── web/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── auth/
│       │   ├── platform/
│       │   ├── tenants/
│       │   ├── subscriptions/
│       │   ├── stores/
│       │   ├── staff/
│       │   ├── products/
│       │   ├── inventory/
│       │   ├── pos/
│       │   ├── pharmacy/
│       │   ├── reports/
│       │   └── analytics/
│       ├── hooks/
│       ├── lib/
│       └── styles/
│
└── api/
    └── src/
        ├── auth/
        ├── platform/
        ├── tenants/
        ├── memberships/
        ├── authorization/
        ├── subscriptions/
        ├── entitlements/
        ├── stores/
        ├── products/
        ├── inventory/
        ├── purchasing/
        ├── sales/
        ├── payments/
        ├── pharmacy/
        ├── reporting/
        ├── ai/
        ├── audit/
        ├── notifications/
        └── common/
```

Each NestJS module should have clear responsibilities.

For example:

```text
products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── products.repository.ts
├── products.schemas.ts
├── products.types.ts
└── products.spec.ts
```

You do not have to create a custom repository abstraction for every simple query. Use abstractions where they clarify business rules, protect tenant boundaries, or improve testability.

The objective is maintainable architecture, not the maximum number of files.

---

# 15. Security Requirements

Security must be part of the definition of done for every module.

## 15.1 Authentication

Implement:

- Secure password hashing with Argon2id.
- Login rate limiting.
- Secure session or token handling.
- Token expiration and refresh rules.
- Logout and revocation behavior.
- Account activation and deactivation.
- Password reset.
- Optional multi-factor authentication for privileged accounts.
- Session and device management where appropriate.

If using JWTs, remember that JWTs do not automatically provide revocation or eliminate the need for server-side authorization checks.

For browser applications, consider short-lived access tokens with a carefully designed refresh mechanism. HttpOnly, Secure cookies can reduce exposure to token theft from JavaScript, but cookie-based authentication also requires CSRF protections appropriate to the deployment model.

## 15.2 API security

Configure:

- Helmet.
- HTTPS in production.
- CORS allowlists.
- Rate limiting.
- Request validation.
- Appropriate request-size limits.
- Standardized error handling.
- Database least-privilege access.
- Secure secrets management.
- Audit logging.
- Dependency scanning.

Never return stack traces, passwords, tokens, or sensitive internal details in production API errors.

## 15.3 Audit logging

Log important actions, including:

- Login and authentication failures.
- Role and permission changes.
- Staff deactivation.
- Store configuration changes.
- Stock adjustments.
- Sale voids and refunds.
- Price changes.
- Pharmacy batch changes.
- Subscription changes.
- Sensitive platform support access.

A useful audit record includes:

```text
id
tenant_id
actor_user_id
action
resource_type
resource_id
timestamp
request_id
metadata
```

Where justified, capture the relevant before-and-after state, but avoid storing unnecessary personal information or secrets.

Audit logs should be protected against unauthorized modification.

---

# 16. Offline Operation and Transaction Reliability

You did not explicitly require offline support in this request, so I would not make it a mandatory first-release feature without further confirmation.

However, a POS platform may need to operate during network interruptions. If that is a future requirement, plan for it now because offline sales significantly affect transaction design.

Offline support is not simply caching the React application.

It requires:

- Local transaction storage.
- Unique transaction identifiers.
- Idempotent synchronization.
- Conflict handling.
- Secure device storage.
- Inventory reservation or overselling policies.
- Payment reconciliation.
- Recovery after failed synchronization.
- Explicit handling of uncertain transaction outcomes.

For pharmacies, offline operation must also respect expiry, dispensing, and any other restrictions that cannot safely be bypassed.

I would build a reliable online-first POS first, then implement offline capabilities as a separate, carefully tested milestone.

---

# 17. Development Roadmap

Do not build all modules simultaneously. That increases integration problems and makes it difficult to determine whether the system's foundations are correct.

I recommend a staged implementation using iterative development.

## Phase 1: Requirements and architecture

**Deliverables**

- Business requirements document.
- Functional and nonfunctional requirements.
- Use-case catalogue.
- System architecture.
- Database ERD.
- RBAC and ABAC policy matrix.
- Subscription entitlement model.
- UI design system.
- API conventions.
- Test strategy.

**Exit criteria**

All planned modules have defined responsibilities, dependencies, permissions, and acceptance criteria.

## Phase 2: Application foundation

**Implement**

- React application shell.
- NestJS application foundation.
- PostgreSQL connectivity.
- Database migrations.
- Configuration management.
- Structured error handling.
- Logging.
- Joi validation.
- Helmet.
- API documentation.
- Initial automated testing.

**Exit criteria**

The application can start reliably, connect to PostgreSQL, apply migrations, validate requests, and expose documented API endpoints.

## Phase 3: Identity, tenancy, and authorization

**Implement**

- Authentication.
- Users.
- Tenants.
- Tenant memberships.
- Store membership scopes.
- Roles and permissions.
- Tenant isolation.
- Platform administrator access.
- Tenant administrator access.
- Audit logs.

**Exit criteria**

Automated tests demonstrate that unauthorized users cannot access other tenants' data, modify forbidden resources, or bypass permission checks.

This phase is a hard gate. Do not begin exposing substantial operational data before these controls are working.

## Phase 4: Subscription and entitlement engine

**Implement**

- Subscription packages.
- Plan versioning.
- Entitlement definitions.
- Tenant subscriptions.
- Store limits.
- Staff limits.
- Module restrictions.
- Subscription lifecycle.
- Usage tracking.

**Exit criteria**

The API correctly enforces package limits under concurrent requests, and package changes behave according to documented subscription rules.

## Phase 5: Core retail operations

**Implement**

- Business profile.
- Store management.
- Product catalogue.
- Categories and barcodes.
- Inventory.
- Suppliers.
- Purchasing.
- POS.
- Sales.
- Payments.
- Receipts.
- Returns and refunds.
- Cash management.

**Exit criteria**

A complete sale can be processed, persisted, retrieved, reconciled, and reflected in inventory and reports without compromising transaction integrity.

## Phase 6: Pharmacy operations

**Implement**

- Drug catalogue.
- Batch tracking.
- Expiry management.
- FEFO allocation.
- Prescription workflows.
- Dispensing records.
- Returns and quarantine.
- Pharmacy-specific reporting.
- Appropriate access restrictions.

**Exit criteria**

Pharmacy-specific business rules pass automated tests, including batch selection, expiry restrictions, and traceability.

## Phase 7: Business intelligence

**Implement**

- Sales metrics.
- Profit and margin calculations.
- Store comparisons.
- Inventory risk.
- Product performance.
- Pharmacy expiry exposure.
- Exportable reports.

**Exit criteria**

All metrics have documented formulas, match independently verified calculations, and respect tenant/store access restrictions.

## Phase 8: AI analytics

**Implement**

- Approved analytical data services.
- AI provider integration.
- Forecasting or recommendation workflows.
- Structured output validation.
- Explanation and uncertainty handling.
- AI usage limits.
- Privacy controls.
- Monitoring and cost tracking.

**Exit criteria**

AI outputs are validated, appropriately scoped, tested for misleading results, and prevented from bypassing business rules.

## Phase 9: Hardening and release

**Implement**

- End-to-end testing.
- Security testing.
- Performance testing.
- Backup and recovery testing.
- Deployment automation.
- Monitoring and alerting.
- User documentation.
- Production configuration.
- Release checklist.

**Exit criteria**

All mandatory acceptance criteria pass, critical defects are resolved, recovery procedures are verified, and release approval is documented.

---

# 18. Definition of Done

Your definition of done should be measurable.

A task is not complete simply because the interface looks correct or the developer reports that the feature works.

## 18.1 Feature completion checklist

Every feature must satisfy the applicable requirements below.

| Category | Completion requirement |
|---|---|
| Requirements | Acceptance criteria are documented and satisfied |
| Frontend | Interface works across supported screen sizes |
| API | Endpoints follow documented contracts |
| Validation | Invalid inputs are rejected consistently |
| Authorization | Permissions and resource scopes are enforced server-side |
| Tenancy | Cross-tenant access is prevented |
| Persistence | Data survives application restarts |
| Integrity | Database constraints and transactions protect business rules |
| Integration | Relevant pages reflect persisted changes correctly |
| Empty states | No fabricated operational data is required |
| Errors | Failures produce clear and consistent responses |
| Security | Relevant security checks pass |
| Testing | Unit and integration tests pass |
| Documentation | API and user-facing behavior are documented |
| Observability | Important failures and security events can be diagnosed |
| Tracking | Task status and test evidence are recorded |

## 18.2 Testing layers

### Unit tests

Test isolated business rules, including:

- Subscription limit calculations.
- Permission evaluation.
- Product validation.
- Sale total calculations.
- Refund calculations.
- Expiry restrictions.
- BI formulas.

### Integration tests

Test components working together:

- Authentication and database access.
- Tenant scoping.
- Subscription enforcement.
- Inventory updates.
- Sale persistence.
- Payment recording.
- Refund workflows.
- Pharmacy batch allocation.

### End-to-end tests

Test complete user journeys:

1. Platform administrator creates a subscription package.
2. A tenant subscribes.
3. A tenant administrator configures the business.
4. The administrator creates stores and staff accounts.
5. The administrator creates a custom role.
6. The administrator assigns permissions.
7. An authorized user creates products.
8. The business receives inventory.
9. A cashier processes a sale.
10. Inventory and sales reports update.
11. An unauthorized user attempts to access restricted data and is denied.

### Concurrency and failure tests

Also test:

- Two simultaneous sales involving the same limited stock.
- Two simultaneous store-creation requests at the subscription limit.
- Duplicate payment callbacks.
- Retried API requests.
- Database failures during a sale.
- Expired authentication sessions.
- Subscription suspension during active use.

These tests are particularly important because many serious POS failures occur in edge cases rather than ordinary happy-path workflows.

---

# 19. Development Progress Tracking

Use a persistent project tracker instead of relying on conversational progress reports.

A task record could contain:

```text
id
module
task_title
description
priority
status
dependencies
acceptance_criteria
implementation_reference
test_reference
verified_by
completed_at
```

Suggested statuses:

```text
BACKLOG
READY
IN_PROGRESS
BLOCKED
IN_REVIEW
TESTING
DONE
```

A task should only move to `DONE` when the relevant acceptance criteria have been verified.

For example:

| Task | Status | Completion evidence |
|---|---|---|
| Tenant database isolation | Testing | Cross-tenant integration tests |
| Custom roles | In Progress | API and UI implementation |
| Subscription store limits | Ready | Acceptance criteria defined |
| Product persistence | Backlog | Not yet implemented |
| Pharmacy expiry enforcement | Backlog | Rules require implementation |
| BI sales calculations | Backlog | Metric definitions require approval |

These statuses are illustrative, not claims about the actual state of your project.

The tracker should also distinguish between implemented, tested, and deployed. A feature can be implemented but still fail testing, and a tested feature can still be absent from the production deployment.

---

# 20. Additional Requirements You Should Decide Before Coding

The architecture above establishes a strong foundation, but several business decisions remain unresolved.

These are not minor details. They affect the database, API contracts, and implementation effort.

| Decision | Why it matters |
|---|---|
| Country and target market | Determines tax, currency, pharmacy, and regulatory requirements |
| Subscription billing model | Determines renewals, invoices, grace periods, and payment integration |
| Payment methods | Determines payment workflows and reconciliation |
| Inventory costing method | Affects stock valuation and gross profit |
| Product sharing between stores | Determines catalogue and pricing relationships |
| Centralized versus store-specific pricing | Affects product and POS design |
| Multiple currencies | Affects pricing, accounting, and reporting |
| Offline POS | Requires synchronization and conflict handling |
| Accounting requirements | Determines whether basic expenses are enough or a broader ledger is needed |
| Pharmacy scope | Determines prescription, dispensing, controlled medicine, and regulatory workflows |
| SaaS billing jurisdiction | Determines applicable invoicing and tax treatment |
| Tenant onboarding | Determines registration, verification, and activation workflows |

For Tanzania, explicitly define TZS support, applicable tax configuration, receipt requirements, payment-provider integrations, and pharmacy compliance requirements.

Do not hardcode tax rates or assume that every business follows the same tax treatment. Keep applicable rules configurable and versioned, with changes governed by authorized administrators.

---

# 21. My Recommended Initial Release

Your long-term vision is substantial. Attempting to deliver every module, AI feature, BI capability, pharmacy workflow, and subscription variation in one development cycle would be a poor execution strategy.

I recommend the following initial release.

### Foundation

- Authentication.
- Tenant isolation.
- Platform administration.
- Tenant administration.
- RBAC and ABAC.
- Subscription plans and entitlements.
- Store limits.
- Module access controls.
- Audit logging.

### Retail operations

- Products.
- Suppliers.
- Purchasing.
- Inventory.
- POS.
- Sales.
- Payments.
- Receipts.
- Returns.
- Basic reporting.

### Pharmacy operations

- Pharmacy feature toggle.
- Drug catalogue.
- Batch inventory.
- Expiry management.
- FEFO.
- Core prescription and dispensing workflows appropriate to the approved scope.

### Intelligence

- Operational dashboard.
- Sales reports.
- Inventory alerts.
- Initial BI dashboard.

### AI

Begin with one high-value feature: **AI-assisted sales and inventory analysis**.

This is more useful as an initial AI capability than an unrestricted chatbot with access to every part of the database.

Advanced forecasting, automated replenishment, and more complex analytical workflows can follow after sufficient reliable historical data exists.

---

# 22. Final Architecture Recommendation

The core technical design should follow these principles:

1. **React + TypeScript** for the frontend.
2. **NestJS + TypeScript** for a modular REST API.
3. **PostgreSQL** for persistent transactional data.
4. **Prisma or an equivalent database access layer** for controlled schema and data operations.
5. **Joi** for explicit server-side request validation.
6. **Helmet and complementary controls** for HTTP security.
7. **RBAC + ABAC** for permission and resource-scope enforcement.
8. **Centralized subscription entitlements** for package limits and module access.
9. **Tenant-aware data access** with database-level integrity protections.
10. **TanStack Query** for consistent server-state management and cache invalidation.
11. **A centralized design system** for the premium visual identity.
12. **Auditable transactional workflows** for sales, payments, inventory, and pharmacy operations.
13. **A BI layer** with documented metric definitions.
14. **A controlled AI integration layer** that operates on authorized analytical data.
15. **Automated testing and persistent progress tracking** to enforce the definition of done.

The single most important principle is this:

**Build the platform's rules before building the screens that depend on them.**

If tenant isolation, authorization, subscriptions, and transaction integrity are designed correctly, the remaining modules can build on a stable foundation. If these are implemented inconsistently across the application, you will accumulate security vulnerabilities, duplicated logic, incorrect reports, and expensive architectural rework.

## Let's establish the project requirements before implementation

I need you to make five decisions so the architecture can be refined into an executable development plan.

**1. Deployment target**

Which environment are you targeting?

- **A.** Local development using XAMPP for the development environment, with Node.js and PostgreSQL installed separately.
- **B.** A cloud-hosted SaaS platform.
- **C.** Local development first, then cloud deployment.

**2. Authentication model**

- **A.** Email and password.
- **B.** Email, password, and optional multi-factor authentication.
- **C.** Email, phone number, password, and optional multi-factor authentication.

**3. Subscription payments**

- **A.** Manual subscription activation by the platform administrator initially.
- **B.** Automated online subscriptions and recurring payments.
- **C.** Manual activation initially, with automated payments designed into the architecture for a later release.

**4. POS connectivity**

- **A.** Online-only POS.
- **B.** Online POS with a planned offline mode.
- **C.** Offline-capable POS from the first release.

**5. Development approach**

- **A.** Build the complete requirements document, database ERD, architecture, permission matrix, and development plan before coding.
- **B.** Design the architecture, then build and test one module at a time.
- **C.** Use a combined approach: establish the complete architecture and requirements first, then implement incrementally with tests and a persistent progress tracker.

**My recommendation is**
1. Confirmed Project Decisions
| Area | Confirmed decision | Implementation implication |
|---|---|---|
| Development environment | Local development, followed by cloud deployment | Local PostgreSQL, React, and NestJS; production-ready configuration from the beginning |
| Authentication | Email and password, with optional MFA | Secure authentication, MFA enrollment, recovery, session management |
| Subscription billing | Automated online subscriptions and recurring payments | Payment provider integration, billing lifecycle, webhooks, reconciliation |
| POS connectivity | Online initially, with offline mode planned | Online-first architecture with future synchronization support |
| Planning approach | Complete documentation before coding | Requirements, ERD, architecture, authorization matrix, design system, implementation plan |
| Implementation approach | Incremental development | Module-by-module delivery, automated tests, acceptance criteria |
| Progress management | Persistent project tracker | Track implementation, testing, blockers, and verified completion |


Recommended development environment
Use the following local environment:
- Frontend: React + TypeScript + Vite.
- Backend: NestJS + TypeScript.
- Database: PostgreSQL.
- Database access: Prisma ORM.
- Validation: Joi.
- Security: Helmet, Argon2id, appropriate authentication controls, and rate limiting.
- API documentation: OpenAPI/Swagger.
- Frontend data management: TanStack Query.
- Testing: Vitest for suitable frontend tests, Jest for NestJS unit tests, and Playwright for end-to-end testing.
- Version control: Git and GitHub.
- Deployment: Cloud hosting for the frontend and API, plus managed PostgreSQL or a properly administered PostgreSQL server.
XAMPP is not necessary for this stack. It primarily provides an Apache, PHP, and MariaDB/MySQL environment, whereas this project uses Node.js and PostgreSQL. You can keep your existing XAMPP installation for other PHP projects without using it as the foundation of this application.
2. The Project Will Have Three Architectural Boundaries
Before we build the individual modules, we need to establish three boundaries that must remain consistent throughout the application.
A. Platform boundary
Controls the SaaS business itself.

Includes:
- Tenant onboarding and management.
- Subscription plans.
- Subscription billing.
- Global module availability.
- Platform administrators.
- Platform-level security and audit logs.
- Platform analytics.
B. Tenant boundary
Controls each subscribing business.

Includes:
- Business configuration.
- Store management.
- Staff accounts and memberships.
- Custom roles and permissions.
- Module configuration.
- Business-specific products, inventory, and transactions.
- Tenant-specific reporting.
C. Store boundary
Controls individual branches within a tenant.

Includes:
- Store inventory.
- Sales and cash sessions.
- Store-level staff permissions.
- Stock transfers.
- Store-specific operational reporting.
- Store-specific configuration where permitted.
A tenant administrator may manage all stores belonging to their business, while a store manager may be restricted to one or several assigned stores.

These boundaries must be enforced by the backend and database, not merely represented in the frontend navigation.
3. Important Architectural Decisions to Lock In
There are several consequences of your choices that we should address before producing the final ERD.
3.1 Authentication and MFA
The authentication architecture should support:
- Email and password login.
- Email verification.
- Password reset.
- Optional authenticator-app MFA.
- Recovery codes.
- Session and refresh-token management.
- Account deactivation.
- Login rate limiting.
- Security event logging.
I recommend using short-lived access tokens and a carefully designed refresh mechanism. For browser clients, consider secure, HttpOnly cookies where appropriate, with corresponding CSRF protections.

MFA should be optional at the platform level initially, but the architecture should support policies that require it for privileged roles.

For example, a platform administrator might be required to enable MFA even when ordinary tenant staff are not.
3.2 Automated subscriptions
The subscription system needs more than a payment button.

It must manage:
1. Subscription plan selection.
2. Checkout initiation.
3. Payment-provider communication.
4. Payment verification.
5. Subscription activation.
6. Renewal scheduling or provider-managed recurring billing.
7. Failed payments.
8. Retry policies.
9. Grace periods.
10. Cancellation.
11. Refunds where applicable.
12. Invoice and payment records.
13. Subscription status changes.
14. Entitlement updates.
15. Reconciliation between your records and the payment provider.
A critical payment-security rule
Never activate a paid subscription merely because the frontend reports that payment succeeded or redirects the customer to a success page.

Instead, verify the payment using a trusted provider-side mechanism, such as a verified webhook or server-to-server verification request.

Webhook processing must be authenticated, idempotent, and safe to retry.

You should also distinguish between the subscription's status and the status of an individual payment. A failed renewal payment does not necessarily mean the subscription should be immediately terminated.
Tanzania and payment providers
Because your target market may include Tanzania, we should evaluate suitable providers before selecting one.

The comparison should cover:
- Tanzanian payment methods.
- Mobile money support.
- Card payments.
- Merchant onboarding requirements.
- Recurring-payment support.
- Settlement currencies.
- Webhook reliability.
- Refund support.
- Fees.
- Reconciliation capabilities.
Do not assume that every payment provider supports true recurring billing for every payment method.

A payment provider might support recurring card charges but require a different workflow for mobile money.

We should select the provider only after confirming the intended commercial model and supported payment methods.
3.3 Planned offline POS
We'll build the initial POS as an online system while avoiding architectural choices that would make offline support unnecessarily difficult later.

The initial design should anticipate:
- Unique transaction identifiers.
- Idempotent API operations.
- Reliable transaction records.
- Explicit payment states.
- Conflict-aware inventory operations.
- Synchronization metadata where appropriate.
- Clear handling of uncertain payment outcomes.
When offline support is introduced, we will need additional capabilities, including local persistence, queued transactions, synchronization, conflict resolution, and rules governing transactions that cannot be safely completed offline.

For pharmacies, offline functionality must never bypass critical restrictions concerning expired products or other regulated workflows.

Offline support will be a planned milestone, not a checkbox we claim to have completed merely because the interface loads without internet access.
4. Documentation We Must Complete Before Coding
I recommend creating the following project documents.
ID	Document	Purpose
DOC-01	Product Requirements Document	Defines the product, business goals, users, scope, and requirements
DOC-02	Functional Requirements Specification	Defines module behavior and acceptance criteria
DOC-03	Nonfunctional Requirements	Defines security, performance, availability, reliability, and accessibility
DOC-04	System Architecture Document	Defines application boundaries, components, and communication
DOC-05	Database Design and ERD	Defines entities, relationships, constraints, and indexes
DOC-06	RBAC and ABAC Permission Matrix	Defines roles, permissions, scopes, and authorization policies
DOC-07	Subscription and Entitlement Specification	Defines packages, limits, feature access, and billing lifecycle
DOC-08	REST API Specification	Defines endpoints, schemas, errors, and authentication requirements
DOC-09	UI/UX Design System	Defines colors, typography, layouts, components, and interaction rules
DOC-10	Security Threat Model	Identifies risks and corresponding controls
DOC-11	Testing Strategy	Defines unit, integration, end-to-end, security, and performance testing
DOC-12	Development Roadmap	Defines milestones, dependencies, and release criteria
DOC-13	AI and BI Specification	Defines metrics, analytical workflows, AI use cases, and privacy boundaries
DOC-14	Deployment and Operations Plan	Defines environments, CI/CD, backups, monitoring, and recovery
DOC-15	Definition of Done and Progress Tracker	Establishes evidence-based completion and project status tracking


These documents should not be created in isolation. For example, the permission matrix must correspond to actual API operations, while the ERD must support the documented business workflows.
5. Implementation Order
Once the documentation is approved, the development sequence should be:

Milestone 1 — Application foundation
- Repository and project structure.
- Development environment.
- PostgreSQL and migrations.
- React and NestJS foundations.
- Logging, validation, error handling, and API documentation.
Milestone 2 — Identity and security
- Authentication.
- MFA.
- Tenant membership.
- Platform and tenant authorization.
- RBAC and ABAC.
- Audit logging.
- Tenant isolation tests.
Milestone 3 — Subscription engine
- Subscription plans.
- Plan versioning.
- Entitlements.
- Usage limits.
- Subscription lifecycle.
- Payment-provider integration.
- Webhooks and reconciliation.
Milestone 4 — Tenant administration
- Business profile.
- Stores.
- Staff management.
- Custom roles.
- Permission assignment.
- Module toggles.
Milestone 5 — Retail operations
- Products.
- Inventory.
- Purchasing.
- Suppliers.
- POS.
- Payments.
- Returns.
- Receipts.
Milestone 6 — Pharmacy operations
- Drug catalogue.
- Batches.
- Expiry management.
- FEFO.
- Prescription and dispensing workflows.
- Pharmacy-specific reporting.
Milestone 7 — BI and AI
- Operational dashboards.
- Business reports.
- Inventory analysis.
- Sales analysis.
- AI-assisted decision support.
Milestone 8 — Offline capability
- Local transaction persistence.
- Synchronization.
- Conflict handling.
- Reconciliation.
- Offline-specific testing.
Milestone 9 — Production readiness
- Security assessment.
- Performance testing.
- Backup and recovery verification.
- Deployment automation.
- Monitoring.
- Release approval.
We will not mark a milestone complete until its defined acceptance criteria and required tests pass.
6. How We Will Track Progress
The project tracker will be the source of truth for implementation status.

Every task should have:
- A unique identifier.
- A module.
- A clear description.
- Dependencies.
- Acceptance criteria.
- Priority.
- Implementation status.
- Test status.
- Evidence of verification.
- Completion date.
For example:
Task ID	Task	Implementation	Testing
SEC-001	Enforce tenant-scoped data access	Not started	Not started
SEC-002	Implement custom role permissions	Not started	Not started
SUB-001	Define subscription entitlements	Not started	Not started
SUB-002	Enforce maximum store count	Not started	Not started
POS-001	Implement transactional sale creation	Not started	Not started
PHM-001	Prevent expired-stock dispensing	Not started	Not started
BI-001	Define and validate sales metrics	Not started	Not started


These are initial planning entries, not evidence that implementation has begun.

We can maintain the tracker in a version-controlled Markdown file initially and move to a more structured issue tracker when the workflow requires it.
7. The Next Step: Finalize the Product Scope
Before we write the complete requirements document and ERD, I recommend resolving one final group of business decisions.

These decisions will influence the database schema and API design, so guessing would be irresponsible.
A. Target market
Should the initial release target:
1. Tanzania only.
2. East Africa.
3. International customers from the beginning.
My recommendation is to launch in Tanzania while designing the platform to support additional countries. This avoids implementing every country's tax and regulatory requirements in the first release.
B. Product and inventory sharing
How should products work across stores?
1. Each store has an independent product catalogue.
2. All stores share a tenant-wide catalogue, but maintain separate stock quantities.
3. The tenant can choose between shared and store-specific catalogues.
I recommend option 2 initially. A shared catalogue with store-specific inventory is easier to govern and report on. Store-specific pricing and availability can still be supported separately.
C. Subscription pricing model
How should packages charge customers?
1. Fixed monthly or annual price per tenant, with included limits.
2. Price per store.
3. Base subscription plus additional charges for stores, staff, or premium modules.
I recommend option 3, provided the billing rules remain transparent. It supports a flexible SaaS business model, but the entitlement and invoicing logic must be carefully designed.
D. Pharmacy prescription requirements
Which pharmacy scope do you want?
1. Inventory, batches, and expiry management only.
2. Inventory plus prescription and dispensing management.
3. A comprehensive pharmacy system, including prescription workflows, controlled-medicine controls where applicable, dispensing, batch traceability, and regulatory reporting.
I recommend option 3 as the long-term target, with implementation and legal compliance validated against the actual requirements of the target market.
E. Accounting scope
Should the system include:
1. Basic sales, expenses, and profit reports.
2. Sales, expenses, cash management, accounts payable, and accounts receivable.
3. A full accounting system with a double-entry general ledger.
I recommend option 2 for the initial release, with a properly defined accounting integration or general-ledger extension later. Do not calculate profit from sales alone: the system must account for cost of goods sold, returns, discounts, and applicable adjustments.

Answers: 
A. Target market : launch in Tanzania while designing the platform to support additional countries. 
B. Product and inventory sharing: The tenant can choose between shared and store-specific catalogues.  
C. Subscription pricing model: I recommend **option 3**, provided the billing rules remain transparent. It supports a flexible SaaS business model, but the entitlement and invoicing logic must be carefully designed.  
D. Pharmacy prescription requirements: I recommend option 3 as the long-term target, with implementation and legal compliance validated against the actual requirements of the target market.  
E. Accounting scope: I recommend both Sales, expenses, cash management, accounts payable, and accounts receivable, and A full accounting system with a double-entry general ledger.