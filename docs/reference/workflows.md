# GitHub Actions workflows

## `ci.yml`

Runs on pull requests and pushes to `main`. A Postgres 17 service provides the test database. Steps: install, lint, typecheck, test, then the Playwright smoke test (`pnpm --filter @cf/web test:e2e`) against the test database with the fake Profile source.

## `ingest.yml` (Nightly ingest)

| Trigger                         | Mode                  |
| ------------------------------- | --------------------- |
| `0 3 * * 0` (Sundays, UTC)      | discovery and refresh |
| `0 3 * * 1-6` (other days, UTC) | refresh only          |
| Manual (`workflow_dispatch`)    | discovery and refresh |

Settings: 120 minute timeout; a `concurrency` group so two ingests never overlap, without cancelling a running one.

Steps: install, migrate (up to five attempts, 10 seconds apart), then run the ingest. A non-zero exit shows the run as failed.

Secrets: `DATABASE_URL` and `INGEST_GITHUB_TOKEN`. See [Environment variables](environment-variables.md).
