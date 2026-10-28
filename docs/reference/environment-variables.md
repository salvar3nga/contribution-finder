# Environment variables

| Variable              | Used by                       | Description                                                                                    |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | ingest, `@cf/db` migrate      | Postgres connection string. Required                                                           |
| `GITHUB_TOKEN`        | ingest, web (Profile builds)  | GitHub token for the GraphQL API. Read-only public access is enough. Required                  |
| `FAKE_PROFILE_SOURCE` | web                           | Set to `1` to replace the GitHub Profile source with a fake. Used by the Playwright smoke test |
| `TEST_DATABASE_URL`   | ingest, profile and web tests | Test database. Defaults to `postgresql://cf:cf@localhost:5432/contribution_finder_test`        |

`.env.example` lists the local defaults. `.env` is gitignored.

Nothing loads `.env` automatically. Use `tsx --env-file=<path>` or export the variables into your shell.

## GitHub Actions secrets

| Secret                | Maps to                                |
| --------------------- | -------------------------------------- |
| `DATABASE_URL`        | `DATABASE_URL` in the nightly workflow |
| `INGEST_GITHUB_TOKEN` | `GITHUB_TOKEN` in the nightly workflow |
