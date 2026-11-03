# Development Workflow

Run commands from the repository root unless noted otherwise. Use Node.js 24.x, as pinned in the root `.nvmrc` and `package.json` engines field. The root `package.json` is the authoritative list of available scripts; use `npm run` to inspect it. API OpenAPI generation is available, but its request/response schemas are incomplete and the project is not yet a release candidate. See the [production-readiness roadmap](../../production-readiness-roadmap.md) for current evidence and completion gates.

## Development servers

```bash
npm run dev:api
npm run dev:web
```

The API loads configuration from the root `.env`; the web client uses `VITE_API_BASE_URL` in `apps/web/.env` or its localhost default. See [environment variables](environment-variables.md).

## Build and typecheck

```bash
npm run typecheck
npm run build:api
npm run build:web
npm run build
```

`npm run build:web` performs a TypeScript build and Vite production bundle. Both builds and the root typecheck pass in the current local verification.

## Tests and lint

The destructive API integration suites require a dedicated PostgreSQL database whose name ends in `_test`. The Jest config loads root `.env` and then `.env.test`, while preserving an explicitly supplied `DATABASE_URL`; copy `.env.test.example` to `.env.test`, set its connection string, then create that database. Before migrating or seeding, temporarily set `DATABASE_URL` to that same test URL so Prisma targets the isolated database. The integration suites refuse to run against a database with any other name.

On Windows PowerShell, set the connection string for the current shell before database setup:

```powershell
$env:DATABASE_URL = "postgresql://postgres:<local-password>@localhost:5432/saas_pos_test?schema=public"
npm run migrate:deploy
npm run migrate:status
npm run db:seed
npm test
```

Replace the example password with the local PostgreSQL password. Keep `.env.test` local and never commit it.

Available root commands:

```bash
npm test
npm run test:isolation
npm run test:concurrency
npm run test:pharmacy
npm run lint
```

The root test command runs the 29 Chromium Playwright tests (which mock API calls) followed by the API Jest suite. The API suite includes live HTTP integration tests for verification, MFA, password recovery, refresh rotation/replay, session revocation, tenant business settings, platform lifecycle, membership deactivation, tenant role administration with cross-tenant and privilege-escalation checks, fiscal simulator boundaries, and the test-only fiscal add-on billing lifecycle. Install the browser once with `npx playwright install chromium` if it is missing. The API suite requires the isolated `saas_pos_test` database described above; never run it against a development or production database. The current API result is 24 suites/135 tests passing. The latest full browser run passed 28/29; one unrelated view-only Sales test has an ambiguous non-exact `Sales` locator that also matches `Open sales`. All three fiscal browser tests pass. The dedicated API test wrappers run under the API workspace, for example:

```bash
npm --workspace apps/api run test
```

The browser smoke tests do not replace backend-integrated E2E or CI release verification. There are no configured root `test:e2e`, `test:cov`, `test:watch`, `lint:fix`, or format scripts.

## Database

```bash
npm run migrate:deploy
npm run migrate:status
npm run prisma:generate
npm run db:seed
```

Install and start PostgreSQL 15+ directly on the development machine before running database commands.
`npm run migrate:reset` destroys database data. Use it only with an explicitly disposable local database after confirming the data can be lost. Migration deployment to a clean database still needs documented CI/release evidence.

## API documentation and background jobs

In development, Swagger UI is served at `http://localhost:3000/api/v1/docs`; its OpenAPI JSON is at `/api/v1/docs-json`. Both routes are disabled when `NODE_ENV=production`.

Run `npm run docs:api` to rebuild the API and regenerate the checked-in contract at `documentations/api/openapi.json`. The generator initializes `AppModule` and Prisma, so use a local or disposable test database by setting `DATABASE_URL`; never point documentation generation at production. The current spec covers 126 paths / 151 operations and documents all 68 request bodies; 57 operations have explicit response schemas, and broader response coverage remains incomplete.

`npm run docs:api:serve` starts the already-built API. Background job processing code exists, but there are no root `jobs:*` commands; the email/report handlers are placeholders.

## Deployment and CI

There is no configured root deploy script. The GitHub Actions workflow runs lint/typecheck, the root browser/API test command with PostgreSQL and Chromium, dependency audit, and a build job. Remote CI has not yet been verified, and the workflow does not establish a complete backend-integrated E2E, migration-release, staging deployment, or production rollback gate. Review the workflow and roadmap before relying on CI as release evidence.

Never deploy from a local working tree. A production workflow must be added and rehearsed only after the full-system release gates pass.
