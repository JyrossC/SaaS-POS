# API Workspace

The NestJS API is a modular monolith. `src/auth/` resolves persisted users and tenant memberships, `src/authorization/` enforces permission metadata and blocks operations for inactive tenants, and `src/subscription/` loads module access from persisted platform, plan, and tenant settings.

## Implemented API foundation

- `POST /api/v1/auth/login` authenticates against a verified user email, tenant slug, password, and optional MFA/recovery code. Successful tenant authentication issues a 15-minute access token and a rotating HttpOnly refresh cookie.
- `POST /api/v1/auth/refresh` rotates the tenant refresh cookie; `POST /api/v1/auth/logout` revokes the current session.
- `POST /api/v1/auth/email/verify` consumes a single-use verification link; `POST /api/v1/auth/email/verification/resend` returns a generic response.
- `POST /api/v1/auth/mfa/setup`, `/mfa/confirm`, and `/mfa/disable` support optional tenant MFA and one-time recovery codes.
- `GET /api/v1/tenant/me` returns the authenticated membership and store scope.
- `GET /api/v1/subscription/modules` returns server-evaluated module access and persisted usage limits.
- `GET|POST /api/v1/products` and `GET /api/v1/products/:productId` provide tenant-scoped catalogue operations.
- `GET /api/v1/stores/:storeId/inventory` lists scoped inventory.
- `POST /api/v1/stores/:storeId/inventory/stock-adjustments` applies an idempotent, audited adjustment; send an `Idempotency-Key` header.
- `GET /api/v1/installation/status` reports whether first-run platform setup has been completed.
- `POST /api/v1/installation/initialize` creates the first platform administrator and platform name. Supply the deployment-configured `INSTALLATION_SECRET` in `X-Installation-Secret`; the operation is guarded by both a singleton database record and a private `installation-lock.json`.
- `POST /api/v1/platform/auth/login` authenticates platform administrators separately from tenant users and requires MFA after first-login enrollment. Platform refresh cookies and access tokens use a separate audience from tenant sessions. `GET /api/v1/platform/me` requires a platform-audience access token.
- `GET /api/v1/platform/stats` requires an active platform-admin access token.
- `POST /api/v1/platform/tenants/:tenantId/kyb-documents` accepts one encrypted KYB file for a tenant pending review; `GET` on the same path lists metadata, `GET .../:documentId/content` retrieves audited content, and `PATCH .../:documentId/review` records an acceptance or rejection.
- `POST /api/v1/platform/tenants/:tenantId/approve` activates a pending tenant only when it has an accepted KYB document and a current active subscription or trial.
- `POST /api/v1/platform/tenants/:tenantId/reject` rejects only a pending tenant and records the required reason in the platform audit log.
- `GET /api/v1/tenant/onboarding/status` returns the authenticated tenant owner's application state, KYB review notes, and rejection reason while the tenant is pending or rejected.
- `POST /api/v1/tenant/onboarding/kyb-documents` accepts encrypted KYB files for the authenticated pending tenant owner and records the upload in the tenant audit log.
- `POST /api/v1/auth/register` provisions a pending tenant, subscription, owner membership, and default roles, then sends a verification link; the registration response does not issue a session token. After email verification, the owner can sign in while pending or rejected only to the restricted onboarding portal; tenant operations remain denied until activation.
- `POST /api/v1/auth/password/forgot` sends a short-lived reset link by SMTP and returns the same generic response for known and unknown email addresses; reset tokens are never returned by the API.
- `POST /api/v1/auth/password/reset` consumes a single-use, 15-minute reset token, updates the password, and revokes existing sessions. Configure `APP_URL` and SMTP as described in the environment-variable guide; production startup requires the SMTP host, credentials, and sender address. SMTP delivery is not yet wired to other email/notification workflows.
- Fiscal add-on checkout, simulated invoice outcomes, renewal-invoice creation, cancellation/resume, and tenant subscription history are available only when `FISCAL_ADDON_TEST_BILLING_ENABLED=true` in development/test. They use the test-only TZS 35,000 monthly / TZS 400,000 annual catalog values and never make real charges or enable tax calculation, fiscal transactions, or official receipts. Automatic renewal/expiry processing and live payment-provider checkout are not implemented.

All request payloads use strict Joi validation. Money and quantity values are decimal strings with up to four fractional digits to avoid binary floating-point rounding. Product creation and stock changes are persisted with their audit events in database transactions. Tenant/store ownership is enforced in service queries and composite database foreign keys.

## Database setup

Configure `DATABASE_URL`, a `JWT_SECRET` of at least 32 characters, a unique `INSTALLATION_SECRET` of at least 32 characters, `KYB_DOCUMENT_ENCRYPTION_KEY` as base64 for a deployment-held 32-byte key, and a separate production `MFA_ENCRYPTION_KEY` of at least 32 characters. Keep the MFA encryption key stable and backed up; losing or replacing it makes existing authenticator secrets unreadable. `PRIVATE_STORAGE_PATH` is resolved relative to the repository root unless it is absolute; point it to persistent private storage outside any web-served directory. Generate the Prisma client with `npm run prisma:generate`, apply migrations with `npm run migrate:deploy`, then run `npm run db:seed` to create only the system permission and platform-module catalogs. Seeding is idempotent and intentionally creates no tenant, user, product, inventory, or sales records.

First-run platform installation, separate platform-admin login, encrypted private KYB uploads, platform review, a gated tenant-approval endpoint, and tenant self-registration with configured plan assignment/trials and default owner membership/roles are implemented. Pending/rejected owners receive an application-only session with no tenant permissions; only owners can upload KYB documents or read their application status and review reasons. KYB uploads are limited to 10 MB and PNG/JPG/JPEG/PDF/DOCX content; access expires at the five-year deadline and a background purge removes expired ciphertext every 15 minutes. The purge is audited. Platform-admin review UI, platform provisioning, owner invitations, and broader tenant/platform administration remain in progress. Do not activate tenants outside the approval endpoint.
