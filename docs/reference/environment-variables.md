# Environment variables

| Variable            | Used by                  | Description                                                                             |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | ingest, `@cf/db` migrate | Postgres connection string. Required                                                    |
| `GITHUB_TOKEN`      | ingest                   | GitHub token for the GraphQL API. Read-only public access is enough. Required           |
| `TEST_DATABASE_URL` | ingest tests             | Test database. Defaults to `postgresql://cf:cf@localhost:5432/contribution_finder_test` |

`.env.example` lists the local defaults. `.env` is gitignored.

Nothing loads `.env` automatically. Use `tsx --env-file=<path>` or export the variables into your shell.

## GitHub Actions secrets

| Secret                | Maps to                                |
| --------------------- | -------------------------------------- |
| `DATABASE_URL`        | `DATABASE_URL` in the nightly workflow |
| `INGEST_GITHUB_TOKEN` | `GITHUB_TOKEN` in the nightly workflow |
