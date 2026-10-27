# Troubleshoot

## `GitHub GraphQL responded 502`

GitHub timed out on a heavy query. The client already retries 5xx responses four times, and repo search uses small pages. If it still fails, rerun later.

## `P1001: Can't reach database server` (Neon)

Neon suspends idle databases and the first connection can exceed Prisma's connect timeout. The workflow retries the migration up to five times. If it keeps failing, check that the `DATABASE_URL` secret has no stray characters, such as a leading `psql`, quotes or spaces, and that it is the direct (non-pooled) string. Adding `&connect_timeout=30` to the URL also helps.

## `DATABASE_URL is not set` / `GITHUB_TOKEN is not set`

Nothing reads `.env` automatically. Use `tsx --env-file=../../.env` or `set -a; source .env; set +a`.

## `database "contribution_finder_test" does not exist`

Docker only creates it when the Postgres volume is first initialised. Create it manually:

```sh
docker compose exec db psql -U cf -c 'create database contribution_finder_test;'
```

## The Actions job runs for a long time

A full ingest is slow. See [How ingest works](../explanation/how-ingest-works.md). To check progress, count the rows in `"Repo"` and compare over time.

## The run exits with a failure

The run exits non-zero for a fatal error (no database, bad token, a failed search) or when more than 10% of attempted Repos errored. The log lists each failed Repo.
