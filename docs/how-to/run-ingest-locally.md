# Run the ingest locally

## Prerequisites

Postgres is running (`docker compose up -d`), the schema is migrated, and `.env` holds a `GITHUB_TOKEN`. See the [tutorial](../tutorials/getting-started.md) for first-time setup.

Nothing loads `.env` for you. Either pass it to `tsx` or export it into your shell.

## Ingest a small slice

```sh
pnpm --filter @cf/ingest exec tsx --env-file=../../.env src/main.ts --max-repos 5
```

`--max-repos <n>` limits discovery and the number of Repos refreshed.

## Refresh without searching again

```sh
pnpm --filter @cf/ingest exec tsx --env-file=../../.env src/main.ts --skip-discovery
```

This refreshes the Repos already in the database, oldest first, and skips the roughly 1,600 search requests discovery makes.

## Run a full ingest

Omit both flags. A full run stops cleanly when GitHub's rate limit nears the floor and continues next time. See [How ingest works](../explanation/how-ingest-works.md).

## Reset local data

```sh
docker compose down -v
docker compose up -d
set -a; source .env; set +a
pnpm --filter @cf/db migrate
```

`-v` deletes the Postgres volume, which also re-runs the script that creates the test database.

## See what a run did

Each run writes one row to `"IngestRun"`:

```sh
docker compose exec db psql -U cf contribution_finder \
  -c 'select * from "IngestRun" order by id desc limit 3;'
```
