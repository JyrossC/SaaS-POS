# Development Tools Inventory

This project is expected to run as a modern web platform with a Node.js-based API and a PostgreSQL data store.

## Core local toolchain

| Tool | Role |
|---|---|
| Node.js 24.x | Application runtime (pinned by `.nvmrc`) |
| npm bundled with Node.js 24 | Dependency management |
| PostgreSQL 15+ server and client | Primary relational database and migrations |
| Prisma | Schema management and migrations |
| NestJS CLI | API scaffolding and code generation |
| Vite | Frontend dev server and build system |
| Git + GitHub | Source control and review |

## Recommended developer tooling

- VS Code with ESLint, Prettier, Prisma, GitLens, and REST clients
- Swagger UI for API exploration (`http://localhost:3000/api/v1/docs` in development; all 68 request bodies are documented, while explicit response schemas cover 57 operations so far)
- Playwright or Cypress for end-to-end testing
- Jest or Vitest for unit and integration tests
- Grafana or a basic log viewer for monitoring

## Required dev workflows

### Database

- Install and start PostgreSQL as a local operating-system service.
- `npm run migrate:deploy`
- `npm run prisma:generate`

### API

- `npm run dev:api`
- `npm run build:api`
- `npm --workspace apps/api run test`

### Web

- `npm run dev:web`
- `npm run build:web`
- `npm --workspace apps/web run test`

### Available checks

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:isolation`
- `npm run test:concurrency`
- `npm run test:pharmacy`

The configured web lint and browser smoke tests and the API Jest suite pass locally. Current release blockers are tracked in the [production-readiness roadmap](../../production-readiness-roadmap.md).

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
