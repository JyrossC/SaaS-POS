# Environment Variables

This page distinguishes settings currently consumed by the application from names that appear in the example file but are not yet wired into the runtime. Do not infer a working feature from an environment variable being listed.

## Local configuration files

- The API loads the repository-root `.env` file.
- The web client reads `VITE_API_BASE_URL` from `apps/web/.env`; if it is absent, it defaults to `http://localhost:3000/api/v1`.
- Only the root `.env.example` is tracked. There is no `apps/web/.env.example`.
- Never commit `.env` files or real credentials.

## API runtime configuration

The API validates the following required values at startup:

| Variable | Requirement | Purpose |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URI | Prisma database connection |
| `JWT_SECRET` | At least 32 characters | Signs authentication tokens |
| `MFA_ENCRYPTION_KEY` | At least 32 characters in production | Independently encrypts stored authenticator secrets; keep stable across deploys |
| `INSTALLATION_SECRET` | At least 32 characters | Protects first-run platform installation |
| `KYB_DOCUMENT_ENCRYPTION_KEY` | Base64 encoding of exactly 32 bytes | Encrypts KYB documents |
| `FISCAL_CREDENTIAL_ENCRYPTION_KEY` | Optional until fiscal credentials are stored; when set, base64 encoding of exactly 32 bytes | Independently encrypts platform and tenant fiscal-provider credentials; keep stable across deploys |

Optional API values and defaults:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_EXPIRES_IN` | `15m` | Access-token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `PORT` | `3000` | API listen port |
| `PRIVATE_STORAGE_PATH` | `apps/api/var/private` | Private document storage path |
| `NODE_ENV` | `development` | Runtime environment |
| `RATE_LIMIT_WINDOW_MS` | `900000` | General rate-limit window |
| `RATE_LIMIT_MAX` | `100` | Requests allowed per general rate-limit window |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Login attempts allowed per rate-limit window and client IP |
| `PASSWORD_RESET_RATE_LIMIT_MAX` | `5` | Password recovery requests allowed per rate-limit window and client IP |
| `FISCAL_SIMULATOR_ENABLED` | `false` | Enables synthetic fiscal outcomes in development/test only; production startup rejects `true` |
| `FISCAL_ADDON_TEST_BILLING_ENABLED` | `false` | Enables the development/test-only fiscal add-on invoice/payment simulator; production startup rejects `true`, and no real charges are possible |
| `LOG_LEVEL` | `info` | Structured logging level |

Password recovery and tenant email verification use SMTP email delivery. `APP_URL` defaults to `http://localhost:5173` outside production and is required in production. In production, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` are required; `SMTP_USER` and `SMTP_PASSWORD` must be supplied together. `SMTP_PORT` defaults to `587`, and `SMTP_SECURE` defaults to `false` (STARTTLS is required). In development, SMTP values may be omitted, but email workflows return a service-unavailable error until delivery is configured. Password reset and verification APIs do not return their tokens to callers; verification resend responses are generic.

Platform administrators must enroll MFA at first sign-in. Tenant MFA is optional. Access tokens remain in memory; tenant and platform refresh cookies are separate, HttpOnly, SameSite=Strict, and rotate on use. The selected session limits are 15-minute access tokens, 7-day idle expiry, and 30-day absolute expiry. Use HTTPS in production so refresh cookies receive the Secure attribute.

The API's startup validation is the source of truth for required settings. Update this document when the runtime schema changes.

## Web configuration

Create `apps/web/.env` for a non-default API URL:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Only variables prefixed with `VITE_` are exposed to the Vite client bundle. Never put secrets in frontend environment variables.

## Template-only or unverified variables

The root `.env.example` also contains settings such as `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `COOKIE_SECURE`, `ENCRYPTION_KEY`, `DB_POOL_MIN`, `DB_POOL_MAX`, `REDIS_URL`, queue options, payment/AI provider keys, and `SENTRY_DSN`. Their presence in the template does not demonstrate that the corresponding runtime behavior is implemented or configured. SMTP delivery is currently implemented for password recovery and tenant email verification only; it does not establish delivery for other notification workflows. Provider-backed delivery still needs a non-production smoke test. Verify actual code paths and provider setup before depending on other settings; track missing behavior in the [production-readiness roadmap](../../production-readiness-roadmap.md).

## Secret handling

- Replace all example values with unique, high-entropy local secrets before starting the API.
- Generate and store the KYB encryption key as a base64-encoded random 32-byte value.
- Set a separate `MFA_ENCRYPTION_KEY` in production and preserve it during key rotation; existing authenticator secrets cannot be decrypted after replacing it.
- Before storing any fiscal-provider credentials, configure a dedicated `FISCAL_CREDENTIAL_ENCRYPTION_KEY` from the secret manager. Existing fiscal credentials cannot be decrypted after replacing it.
- The fiscal simulator is disabled by default and is not a provider integration. When enabled in development/test, it returns synthetic outcomes only; it never contacts a provider, calculates tax, creates sales, or issues official receipts. Never enable it in production.
- Fiscal add-on test billing is separately disabled by default. When explicitly enabled in development/test, it exercises test invoices, simulated payment outcomes, and subscription state transitions using TZS 35,000 monthly and TZS 400,000 annual test prices. These are not approved commercial prices; the simulator cannot contact a payment provider or make a real charge, and it does not enable fiscal processing. Never enable it in production.
- Do not reuse secrets between environments or commit credentials.
- Production and staging secrets must come from an appropriate secret manager, not checked-in files.
