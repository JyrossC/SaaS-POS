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
| `INSTALLATION_SECRET` | At least 32 characters | Protects first-run platform installation |
| `KYB_DOCUMENT_ENCRYPTION_KEY` | Base64 encoding of exactly 32 bytes | Encrypts KYB documents |

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
| `LOG_LEVEL` | `info` | Structured logging level |

The API's startup validation is the source of truth for required settings. Update this document when the runtime schema changes.

## Web configuration

Create `apps/web/.env` for a non-default API URL:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Only variables prefixed with `VITE_` are exposed to the Vite client bundle. Never put secrets in frontend environment variables.

## Template-only or unverified variables

The root `.env.example` also contains settings such as `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `COOKIE_SECURE`, `ENCRYPTION_KEY`, `DB_POOL_MIN`, `DB_POOL_MAX`, `REDIS_URL`, queue options, SMTP/payment/AI provider keys, and `SENTRY_DSN`. Their presence in the template does not demonstrate that the corresponding runtime behavior is implemented or configured. Verify actual code paths and provider setup before depending on them; track missing behavior in the [production-readiness roadmap](../../production-readiness-roadmap.md).

## Secret handling

- Replace all example values with unique, high-entropy local secrets before starting the API.
- Generate and store the KYB encryption key as a base64-encoded random 32-byte value.
- Do not reuse secrets between environments or commit credentials.
- Production and staging secrets must come from an appropriate secret manager, not checked-in files.
