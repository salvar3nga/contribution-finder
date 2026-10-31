# Commands

## Root scripts

| Command          | What it does                                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`       | Starts the web app (`@cf/web`)                                                   |
| `pnpm build`     | Builds every package                                                             |
| `pnpm lint`      | Lints every package                                                              |
| `pnpm typecheck` | Typechecks every package                                                         |
| `pnpm test`      | Runs every package's tests, one package at a time (they share the test database) |
| `pnpm format`    | Formats the repo with Prettier                                                   |

## Database (`@cf/db`)

| Command                            | What it does                                          |
| ---------------------------------- | ----------------------------------------------------- |
| `pnpm --filter @cf/db migrate`     | Applies existing migrations (`prisma migrate deploy`) |
| `pnpm --filter @cf/db migrate:dev` | Creates and applies a migration after a schema change |
| `pnpm --filter @cf/db generate`    | Regenerates the Prisma client into `src/generated`    |

All of these read `DATABASE_URL` from the environment.

## Ingest (`@cf/ingest`)

Entry point: `apps/ingest/src/main.ts`. It is run by `pnpm --filter @cf/ingest start [flags]` and by the nightly workflow.

| Flag               | Meaning                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `--max-repos <n>`  | Positive integer. Limits discovery and the number of Repos refreshed |
| `--skip-discovery` | Skips the search step and only refreshes stored Repos                |

After the ingest finishes, the run deletes cached Profiles built more than 7 days ago and logs how many it removed.

### Exit codes

| Code | When                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 0    | The run finished, or stopped cleanly at the rate-limit floor                                                           |
| 1    | A fatal error (missing env var, database or token problem, failed search), or more than 10% of attempted Repos errored |
