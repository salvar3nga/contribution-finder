# Deploy the nightly ingest (Neon and GitHub Actions)

The ingest runs on GitHub Actions and writes to a Neon Postgres database. The workflow is `.github/workflows/ingest.yml`.

## 1. Create the database on Neon

1. Create a project at <https://neon.tech> and pick Postgres 17.
2. Click **Connect** and turn **Connection pooling** off to get the direct connection string.
3. Copy only the URL, starting at `postgresql://` and ending with `sslmode=require`. If Neon shows a `psql '…'` command, drop the `psql` and the quotes.

Do not put this URL in your local `.env` as `DATABASE_URL`: local development should keep using the Docker database.

## 2. Add the repository secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret                | Value                                |
| --------------------- | ------------------------------------ |
| `DATABASE_URL`        | the Neon direct connection string    |
| `INGEST_GITHUB_TOKEN` | a GitHub token (see the tutorial)    |

If the token is fine-grained and expires, the nightly job starts failing on that date.

## 3. Run it once by hand

Scheduled runs only fire from the default branch, so push your changes to `main` first. Then open **Actions → Nightly ingest → Run workflow**.

A manual run includes discovery. The first full run usually ends with `(stopped for rate limit)` and exit code 0. That is expected: following runs continue with the oldest-ingested Repos.

## 4. Check the result

In the Neon SQL editor:

```sql
select count(*) from "Repo";
select * from "IngestRun" order by id desc limit 3;
```

## Schedule

| Cron           | When                  | Mode                          |
| -------------- | --------------------- | ----------------------------- |
| `0 3 * * 0`    | Sundays, 03:00 UTC    | discovery and refresh         |
| `0 3 * * 1-6`  | Monday–Saturday       | refresh only (`--skip-discovery`) |

If the run is cold-starting Neon, the migrate step retries up to five times before failing.
