# Development Tools Inventory

This project is expected to run as a modern web platform with a Node.js-based API and a PostgreSQL data store.

## Core local toolchain

| Tool | Role |
|---|---|
| Node.js 18+ | Application runtime |
| npm or pnpm | Dependency management |
| Docker Desktop | Local Postgres and optional Redis |
| PostgreSQL 15+ | Primary relational database |
| Prisma | Schema management and migrations |
| NestJS CLI | API scaffolding and code generation |
| Vite | Frontend dev server and build system |
| Git + GitHub | Source control and review |

## Recommended developer tooling

- VS Code with ESLint, Prettier, Prisma, GitLens, Docker, and REST clients
- Swagger UI for API exploration
- Playwright or Cypress for end-to-end testing
- Jest or Vitest for unit and integration tests
- Grafana or a basic log viewer for monitoring

## Required dev workflows

### Database

- `docker compose up -d`
- `npm run migrate:deploy`
- `npm run prisma:generate`

### API

- `npm run dev:api`
- `npm run build:api`
- `npm run test:api`

### Web

- `npm run dev:web`
- `npm run build:web`
- `npm run test:web`

### Quality gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:isolation`
- `npm run test:concurrency`
- `npm run test:pharmacy`

## Operational tools

- structured log aggregation
- error monitoring service
- background job worker
- secret manager
- CI/CD runner

## Guardrails

- Do not commit `.env` files or secrets.
- Do not use XAMPP or MariaDB as the project’s primary stack for this architecture.
- Keep the workflow centered on PostgreSQL, Node.js, and the SaaS platform requirements.
