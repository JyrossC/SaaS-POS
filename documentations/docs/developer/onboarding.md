# Onboarding — Local Setup

Use these steps to prepare a local development environment. The project is not production-ready; remaining blockers are tracked in the [production-readiness roadmap](../../production-readiness-roadmap.md). The API suite currently has 18 suites and 88 tests, including database-backed HTTP integration tests; API docs include all 40 request-body schemas, but response schemas are currently explicit for only 12 operations.

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 24.x | Application runtime; see the root `.nvmrc` |
| npm | Bundled with Node.js 24 | Dependency management |
| Git | 2.39+ | Version control |
| PostgreSQL server and client | 15+ | Local database and migrations |

### Recommended
- VS Code with the following extensions: ESLint, Prettier, Prisma, GitLens, Thunder Client (API testing).
- A password manager — this platform handles secrets.

## 1. Clone the repository

```bash
git clone <repo-url> saas-pos
cd saas-pos
```

## 2. Install dependencies

```bash
# From the repository root (monorepo layout)
npm ci
```

Expected workspace layout after install:

```
apps/
├── web/      # React + TypeScript + Vite
└── api/      # NestJS + TypeScript + REST
packages/     # Shared TypeScript packages (types, constants, utils)
```

## 3. Install and start PostgreSQL

Install PostgreSQL 15 or newer directly on your development machine, using the official installer for Windows or your operating system's package manager. Start the PostgreSQL service and create local `saas_pos` and `saas_pos_test` databases. Keep the test database separate; integration tests refuse to run against any database whose name does not end in `_test`.

Verify PostgreSQL is running with your operating system's service manager and that the `psql` client can connect to it.

## 4. Configure the environment

Copy the root example and replace all placeholder secrets locally:

```bash
cp .env.example .env
```

There is no tracked `apps/web/.env.example`. The API reads root `.env`; the web client reads `VITE_API_BASE_URL` from `apps/web/.env` (or uses its localhost fallback). Create that file with:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

The API currently requires `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), `INSTALLATION_SECRET` (at least 32 characters), and a valid base64-encoded 32-byte `KYB_DOCUMENT_ENCRYPTION_KEY`. Review [environment-variables.md](environment-variables.md) for which settings are consumed versus still aspirational. Never commit real secrets or local `.env` files.

## 5. Apply database migrations

```bash
# From the repository root
npm run prisma:generate
npm run migrate:deploy
npm run migrate:status
# or with Prisma directly
npx prisma migrate deploy
```

This creates the schema defined in `prisma/schema.prisma`. See `../scaffolding/database-conventions.md` for migration rules.

## 6. Seed foundational data

The platform requires some **legitimate initial configuration** — never fabricated business data:

```bash
npm run db:seed
```

This seeds the system catalog; `seed:platform` is not a configured script.

This creates:

- System permissions (the permission catalogue).
- Default subscription plans and plan versions.
- Required platform configuration.

It does **not** create fake sales, products, customers, or inventory.

## 7. Build and run

### API

```bash
npm run dev:api
# starts NestJS on http://localhost:3000 with hot reload
```

The API listens on port `3000`. In development, Swagger UI is available at `http://localhost:3000/api/v1/docs` and the JSON document at `http://localhost:3000/api/v1/docs-json`. To regenerate the checked-in route-level specification at `documentations/api/openapi.json`, run `npm run docs:api` with `DATABASE_URL` set to a local or disposable test database; generation initializes the API module and connects Prisma. `npm run docs:api:serve` starts the built API and serves Swagger only when `NODE_ENV` is not `production`.

### Frontend

```bash
npm run dev:web
# starts Vite on http://localhost:5173 with hot reload
```

## 8. Verify the install

1. Start the API and web development servers using the commands above.
2. Open `http://localhost:5173` and confirm the app renders.
3. Run the configured checks:

```bash
npm run typecheck
npm run lint
npm run build:api
npm run build:web
```

The web/API builds, root typecheck, lint, six mocked browser smoke tests, and the 18-suite/88-test API suite pass locally. API integration tests exercise live HTTP requests and verify database persistence. The web build still reports a non-blocking large-chunk warning. To run `npm test`, configure the dedicated `_test` database as described in the development workflow; never use the development database for tests.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running | Start the PostgreSQL service using your operating system's service manager. |
| Migration errors | Database or migration state is inconsistent | Inspect the migration error first; only reset a disposable local database after confirming its data can be destroyed. |
| JWT errors | Missing or weak `JWT_SECRET` | Generate one: `openssl rand -base64 48` |
| CORS errors on the frontend | Wrong API base URL in `apps/web/.env` | Set `VITE_API_BASE_URL=http://localhost:3000/api/v1` |
| "Permission denied" on a route | Missing permission in your role | Check the permission catalogue in `../scaffolding/backend-conventions.md` |

## Next steps

- `development-workflow.md` — build, test, lint, deploy.
- `environment-variables.md` — every env var explained.
- `../scaffolding/overview.md` — understand the module structure before editing code.