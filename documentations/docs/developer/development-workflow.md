# Development Workflow

Commands for building, testing, linting, migrating, documenting, and deploying the platform. Run them from the repository root.

## Script index

All scripts are defined in the root `package.json`. List them with:

```bash
npm run
```

## Build

### Frontend (React + Vite)

```bash
# Development server with hot reload
npm run dev:web

# Production build
npm run build:web

# Type-check only (no emit)
npm run typecheck:web
```

### API (NestJS)

```bash
# Development server with hot reload
npm run dev:api

# Production build
npm run build:api

# Type-check only
npm run typecheck:api
```

### Full build (both apps)

```bash
npm run build
```

## Testing

### Unit tests

```bash
# All unit tests
npm run test

# Watch mode
npm run test:watch

# Specific app
npm run test:api
npm run test:web
```

### Isolation and security tests

The platform has explicit cross-tenant isolation and concurrency tests. These are **hard gates** before merging tenant-facing code:

```bash
# Cross-tenant access tests
npm run test:isolation

# Concurrency / race-condition tests (subscription limits, stock)
npm run test:concurrency

# Pharmacy batch and expiry rules
npm run test:pharmacy
```

### E2E

```bash
npm run test:e2e
```

### Coverage

```bash
npm run test:cov
```

## Linting and formatting

```bash
# Lint
npm run lint

# Lint and auto-fix
npm run lint:fix

# Format check
npm run format:check

# Format and write
npm run format
```

## Database migrations

Prisma is the recommended data-access layer. See `../scaffolding/database-conventions.md` for schema rules.

```bash
# Create a migration (after editing prisma/schema.prisma)
npm run migrate:create
# Prompts for a migration name; generates prisma/migrations/<timestamp>_<name>/

# Apply all pending migrations
npm run migrate:deploy

# Reset the database (destroys all data) and re-apply
npm run migrate:reset

# Generate Prisma client after schema changes
npm run prisma:generate
```

**Never edit a migration file after it is applied in any environment.** Create a new migration instead.

## API documentation

OpenAPI/Swagger is generated from decorators and JSDoc on the NestJS controllers and DTOs.

```bash
npm run docs:api        # builds the OpenAPI spec to dist/api-spec.json
npm run docs:api:serve  # serves the Swagger UI locally
```

The Swagger UI is served at `/api/docs` when `NODE_ENV !== production`.

## Seed data

```bash
npm run seed:platform    # permissions, plans, config — never business data
```

## Background jobs

Scheduled and asynchronous tasks run through a job queue.

```bash
npm run jobs:process    # starts the job worker
npm run jobs:list       # lists pending and failed jobs
npm run jobs:retry      # retries failed jobs
```

## Production deployment

### Pre-deploy checks

```bash
npm run build
npm run lint
npm run typecheck
npm run test
npm run migrate:deploy
```

### Deploy

```bash
npm run deploy
```

The deploy script should:

1. Build both apps.
2. Apply pending migrations (never skip this).
3. Run the test suite against the staging database.
4. Deploy the API.
5. Deploy the frontend.
6. Invalidate the CDN / cache.

## CI/CD

The pipeline (`.github/workflows/*.yml`) runs on every push and PR:

1. Install dependencies.
2. Lint and typecheck.
3. Run unit, isolation, and concurrency tests.
4. Build both apps.
5. Run E2E against a fresh database.

Migrations are validated but **not** applied in CI. The deploy job applies them.

## Environment management

All environment variables are documented in `environment-variables.md`. Never commit `.env` files — only `.env.example`.