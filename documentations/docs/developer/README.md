# Developer Onboarding

Welcome to the SaaS Multi-Tenant POS Platform. This directory contains everything a human developer needs to set up, run, test, and contribute to the platform.

- **Prerequisites and local setup** → `onboarding.md`
- **Build, test, lint, migrate, deploy commands** → `development-workflow.md`
- **Branching, commits, PRs, review** → `contributing.md`
- **All environment variables** → `environment-variables.md`

## Directory conventions

```
developer/
├── onboarding.md
├── development-workflow.md
├── contributing.md
└── environment-variables.md
```

Application code lives in `apps/web/` (React) and `apps/api/` (NestJS). See `../scaffolding/overview.md` for the module map.

## Start here

1. Read `onboarding.md` to get a working local environment.
2. Read `environment-variables.md` to understand configuration.
3. Read `development-workflow.md` before opening a PR.
4. Read `contributing.md` for commit and review expectations.