# POS Security Agent

This skill covers authentication, authorization, RBAC/ABAC, rate limiting, secrets handling, and audit concerns for the SaaS POS platform.

## Security principles

- Never trust `tenant_id` or `store_id` from the client.
- Service-side enforcement is required for permissions, module access, entitlements, and price calculation.
- Least privilege is mandatory for platform admin, tenant admin, and support roles.
- Sensitive actions require audit logs.
- Production errors must not expose stack traces or internal secrets.

## Authentication requirements

- Email and password auth by default.
- Optional MFA for privileged accounts.
- Password reset and verification flows.
- Short-lived access tokens and secure refresh strategy.
- Session or token revocation controls.
- Login rate limiting and account lockout policy.
- Secure password hashing with Argon2id.

## Authorization model

The platform uses both RBAC and ABAC.

### RBAC

- Roles and permissions live in tenant-scoped definitions.
- Role permissions should be assignable without code changes.
- Global platform roles remain distinct from tenant roles.

### ABAC

Evaluate:

- user identity
- tenant membership
- role permissions
- store scope
- business rules
- subscription entitlements
- resource attributes and policy context

Authorization decision should include both permission and scope.

## API security controls

- Helmet for security headers
- HTTPS only in production
- Secure cookies with appropriate CSRF handling
- CORS allowlists
- Request validation and request-size limits
- Rate limiting
- Dependency scanning and patched libraries
- Database least privilege
- Secrets in secret manager, never shared across tenants

## Subscription and entitlement enforcement

- Subscription limits are enforced in the API layer.
- Protect against race conditions using transactional coordination or DB locking.
- Module availability must be derived from platform config, plan entitlement, tenant config, and user action.
- UI hiding is never sufficient as a control.

## Audit log requirements

Log all sensitive actions, including:

- login failures and account lockouts
- staff role and permission changes
- store configuration changes
- stock adjustments or transfers
- sale voids, refunds, and price changes
- pharmacy batch and dispensing changes
- subscription changes and support access

Each audit event should include actor, resource, action, timestamp, request context, and relevant metadata.

## Sensitive data handling

- Never commit secret files or environment values.
- Mask or omit tokens and internal identifiers in external logs.
- Use explicit encryption for sensitive business or health data when required.
- Keep AI provider credentials and customer data isolated by authorization boundaries.

## Testing and validation

Security work must be tested with:

- cross-tenant access rejection
- permission boundary checks
- rate-limit enforcement
- IDOR resistance
- audit entry creation and retention
- password reset and MFA recovery flows

## Implementation checklist

- [ ] Auth uses secure hashing and secure session strategy
- [ ] Role and scope checks happen on the server
- [ ] Rate limiting and CORS are configured
- [ ] Audit logs are created for sensitive events
- [ ] Operational secrets are externalized
- [ ] Subscription limits are checked transactionally
- [ ] API responses do not leak internals or stack traces
