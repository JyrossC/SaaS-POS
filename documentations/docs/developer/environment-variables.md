# Environment Variables

This project is designed for a local-first SaaS development workflow using a React frontend, a NestJS API, and a PostgreSQL database. Never commit real secrets or `.env` files. Keep only `.env.example` files in version control.

## Required configuration model

Each runtime should use environment-specific config:

- App runtime configuration in `.env`
- Frontend values in `apps/web/.env`
- API values in `.env` or `apps/api/.env`
- Secrets managed outside the repository in production and staging

## Core environment variables

### Application

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `NODE_ENV` | Yes | `development` | Runtime mode: development, test, production |
| `APP_NAME` | No | `saas-pos` | Human-readable application name |
| `APP_URL` | No | `http://localhost:5173` | Public frontend URL |
| `API_BASE_URL` | No | `http://localhost:3000/api/v1` | API base used by the web app |
| `LOG_LEVEL` | No | `info` | Structured logging level |

### Database

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/saas_pos` | Primary PostgreSQL connection string |
| `DB_POOL_MIN` | No | `2` | Minimum DB pool connections |
| `DB_POOL_MAX` | No | `10` | Maximum DB pool connections |
| `DB_SSL` | No | `false` | Enable TLS for managed PostgreSQL |

### Authentication and sessions

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `JWT_SECRET` | Yes | none | Secret used to sign access tokens |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes for refresh tokens | none | Separate secret for refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `SESSION_SECRET` | No | none | Used if cookie-based sessions are enabled |
| `COOKIE_SECURE` | No | `false` | Restrict cookies to HTTPS in production |
| `COOKIE_HTTP_ONLY` | No | `true` | Prevent client-side JS access to session cookies |
| `PASSWORD_RESET_TOKEN_TTL` | No | `3600` | Reset-token lifespan in seconds |
| `MFA_ISSUER_NAME` | No | `SaaS POS` | MFA issuer for authenticator apps |

### Security and encryption

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `ENCRYPTION_KEY` | Yes for encrypted fields | none | Key used for sensitive field encryption |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Allowed origins for API requests |
| `HELMET_ENABLED` | No | `true` | Enables Helmet security headers |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit window in milliseconds |
| `RATE_LIMIT_MAX` | No | `120` | Requests allowed per window |

### Redis and background jobs

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `QUEUE_NAME` | No | `saas-pos` | Background job queue name |
| `JOB_RETRY_LIMIT` | No | `3` | Maximum job retries |

### File uploads and documents

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `UPLOAD_DIR` | No | `./storage/uploads` | Local upload directory |
| `MAX_FILE_SIZE_MB` | No | `10` | Largest acceptable user upload |
| `S3_ENDPOINT` | No | none | Optional external object storage |
| `S3_BUCKET` | No | none | Bucket for exports or files |
| `S3_ACCESS_KEY_ID` | No | none | Storage credential |
| `S3_SECRET_ACCESS_KEY` | No | none | Storage credential |

### External providers

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `SMTP_HOST` | No | none | Email provider host |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | none | SMTP username |
| `SMTP_PASSWORD` | No | none | SMTP password |
| `SMS_PROVIDER` | No | none | SMS provider identifier |
| `PAYMENT_PROVIDER_API_KEY` | No | none | SaaS billing or payment gateway key |
| `AI_PROVIDER_API_KEY` | No | none | Approved AI analytics provider key |

### Monitoring and observability

| Variable | Required | Default | Purpose |
|---|---|---:|---|
| `SENTRY_DSN` | No | none | Error tracking DSN |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | none | Tracing endpoint |
| `APP_INSIGHTS_CONNECTION_STRING` | No | none | Azure Monitor connection string |

## Example `.env.example`

```env
NODE_ENV=development
APP_NAME=saas-pos
APP_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000/api/v1

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saas_pos
DB_POOL_MIN=2
DB_POOL_MAX=10

JWT_SECRET=replace-with-a-strong-secret
JWT_REFRESH_SECRET=replace-with-a-different-strong-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET=replace-with-a-session-secret
COOKIE_SECURE=false
COOKIE_HTTP_ONLY=true

ENCRYPTION_KEY=replace-with-a-secure-32-byte-key
CORS_ORIGINS=http://localhost:5173
HELMET_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120

REDIS_URL=redis://localhost:6379
QUEUE_NAME=saas-pos
JOB_RETRY_LIMIT=3

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
PAYMENT_PROVIDER_API_KEY=
AI_PROVIDER_API_KEY=

SENTRY_DSN=
LOG_LEVEL=info
```

## Environment-specific behavior

### Local development

- `NODE_ENV=development`
- Local PostgreSQL via Docker or local install
- Dev CORS enabled for the React app
- Optional Redis for background jobs and caching
- Detailed logging, no production masking

### Staging

- Use non-production secrets
- Restrict CORS to staging frontend origins
- Require HTTPS and secure cookies
- Run migrations only through controlled deployment steps

### Production

- Force `NODE_ENV=production`
- Require HTTPS and secure cookies
- Disable detailed stack traces in API responses
- Limit DB connection pools and rate limits aggressively
- Use managed secrets and centralized logging

## Security guardrails

- Never commit `.env`, `.env.local`, or secret files.
- Use a separate secret store in CI, staging, and production.
- Do not reuse the same JWT secret for all environments.
- Rotate secrets on an operational schedule.
- Keep AI provider credentials separated from customer data access permissions.

## Validation checklist

Before starting the app, confirm:

- `DATABASE_URL` is reachable.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` are populated.
- `ENCRYPTION_KEY` exists when sensitive data will be encrypted.
- `CORS_ORIGINS` includes the frontend origin.
- Redis and SMTP credentials are loaded only when the relevant modules are enabled.
