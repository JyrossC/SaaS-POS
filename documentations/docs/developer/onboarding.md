# Onboarding — Local Setup

Get the SaaS Multi-Tenant POS Platform running on your machine in a few steps.

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 18 LTS (>= 18.17) | Runtime for NestJS and Vite |
| npm or pnpm | npm 9+ / pnpm 8+ | Package management |
| Docker Desktop | 4.x+ | PostgreSQL, local infra |
| Git | 2.39+ | Version control |
| PostgreSQL client | 15+ | Running migrations directly (optional; Docker provides this) |

### Recommended
- VS Code with the following extensions: ESLint, Prettier, Prisma, Docker, GitLens, Thunder Client (API testing).
- A password manager — this platform handles secrets.

## 1. Clone the repository

```bash
git clone <repo-url> saas-pos
cd saas-pos
```

## 2. Install dependencies

```bash
# From the repository root (monorepo layout)
npm install
# or with pnpm
pnpm install
```

Expected workspace layout after install:

```
apps/
├── web/      # React + TypeScript + Vite
└── api/      # NestJS + TypeScript + REST
packages/     # Shared TypeScript packages (types, constants, utils)
```

## 3. Start local infrastructure

The platform needs PostgreSQL. Redis is optional at first (caching, rate limiting, background jobs).

```bash
# From the repository root
docker compose up -d
```

`docker-compose.yml` should provide:

- `postgres` — the primary database on port `5432`.
- `redis` (optional) — on port `6379`, only if caching or background jobs are enabled.

Verify connectivity:

```bash
docker compose ps
```

## 4. Configure the environment

Copy the example files and edit them:

```bash
cp .env.example .env          # API configuration
cp apps/web/.env.example apps/web/.env   # Frontend configuration
```

See `environment-variables.md` for the full list and defaults. At minimum you must set:

- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — a strong, random secret (never commit the real value).
- `SESSION_SECRET` — if using cookie-based sessions.
- `ENCRYPTION_KEY` — for data-at-rest encryption of sensitive fields.

## 5. Apply database migrations

```bash
# From the repository root
npm run migrate:deploy
# or with Prisma directly
npx prisma migrate deploy
```

This creates the schema defined in `prisma/schema.prisma`. See `../scaffolding/database-conventions.md` for migration rules.

## 6. Seed foundational data

The platform requires some **legitimate initial configuration** — never fabricated business data:

```bash
npm run seed:platform
```

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

API docs are served at `http://localhost:3000/api/docs` (OpenAPI/Swagger).

### Frontend

```bash
npm run dev:web
# starts Vite on http://localhost:5173 with hot reload
```

## 8. Verify the install

1. Open `http://localhost:5173` — you should see the login screen, not a blank page.
2. Open `http://localhost:3000/api/docs` — the Swagger UI should render the API contract.
3. Run the test suite:

```bash
npm run test
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running | `docker compose up -d postgres` |
| Migration errors | Outdated migrations or dirty state | `npm run migrate:reset` (destroys data) then `npm run migrate:deploy` |
| JWT errors | Missing or weak `JWT_SECRET` | Generate one: `openssl rand -base64 48` |
| CORS errors on the frontend | Wrong API base URL in `apps/web/.env` | Set `VITE_API_BASE_URL=http://localhost:3000/api/v1` |
| "Permission denied" on a route | Missing permission in your role | Check the permission catalogue in `../scaffolding/backend-conventions.md` |

## Next steps

- `development-workflow.md` — build, test, lint, deploy.
- `environment-variables.md` — every env var explained.
- `../scaffolding/overview.md` — understand the module structure before editing code.