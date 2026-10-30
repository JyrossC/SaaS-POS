# API Workspace

The NestJS API is a modular monolith. `src/auth/` resolves persisted users and active tenant memberships, `src/authorization/` enforces permission metadata, and `src/subscription/` loads module access from persisted platform, plan, and tenant settings.

## Implemented API foundation

- `POST /api/v1/auth/login` authenticates against a user email, tenant slug, and Argon2id password hash.
- `GET /api/v1/tenant/me` returns the authenticated membership and store scope.
- `GET /api/v1/subscription/modules` returns server-evaluated module access and persisted usage limits.
- `GET|POST /api/v1/products` and `GET /api/v1/products/:productId` provide tenant-scoped catalogue operations.
- `GET /api/v1/stores/:storeId/inventory` lists scoped inventory.
- `POST /api/v1/stores/:storeId/inventory/stock-adjustments` applies an idempotent, audited adjustment; send an `Idempotency-Key` header.
- `GET /api/v1/installation/status` reports whether first-run platform setup has been completed.
- `POST /api/v1/installation/initialize` creates the first platform administrator and platform name. Supply the deployment-configured `INSTALLATION_SECRET` in `X-Installation-Secret`; the operation is guarded by both a singleton database record and a private `installation-lock.json`.
- `POST /api/v1/platform/auth/login` authenticates platform administrators separately from tenant users. `GET /api/v1/platform/me` requires a platform-audience access token.
- `POST /api/v1/platform/tenants/:tenantId/kyb-documents` accepts one encrypted KYB file for a tenant pending review; `GET` on the same path lists metadata, `GET .../:documentId/content` retrieves audited content, and `PATCH .../:documentId/review` records an acceptance or rejection.
- `POST /api/v1/platform/tenants/:tenantId/approve` activates a pending tenant only when it has an accepted KYB document and a current active subscription or trial.

All request payloads use strict Joi validation. Money and quantity values are decimal strings with up to four fractional digits to avoid binary floating-point rounding. Product creation and stock changes are persisted with their audit events in database transactions. Tenant/store ownership is enforced in service queries and composite database foreign keys.

## Database setup

Configure `DATABASE_URL`, a `JWT_SECRET` of at least 32 characters, a unique `INSTALLATION_SECRET` of at least 32 characters, and `KYB_DOCUMENT_ENCRYPTION_KEY` as base64 for a deployment-held 32-byte key. `PRIVATE_STORAGE_PATH` is resolved relative to the repository root unless it is absolute; point it to persistent private storage outside any web-served directory. Generate the Prisma client with `npm run prisma:generate`, apply migrations with `npm run migrate:deploy`, then run `npm run db:seed` to create only the system permission and platform-module catalogs. Seeding is idempotent and intentionally creates no tenant, user, product, inventory, or sales records.

First-run platform installation, separate platform-admin login, encrypted private KYB uploads, platform review, and a gated tenant-approval endpoint are implemented. Uploads are limited to 10 MB and PNG/JPG/JPEG/PDF/DOCX content; access expires at the five-year deadline and a background purge removes expired ciphertext every 15 minutes. The purge is audited. Tenant self-registration, platform provisioning, configured plan assignment/trials, ten-minute owner invitations, and default membership/role assignment are still pending. Do not activate tenants outside the approval endpoint. POS sale processing and purchasing are not yet implemented.
