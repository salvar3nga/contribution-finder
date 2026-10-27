# Getting started: run the ingest on your machine

By the end of this tutorial you will have the project cloned, a local Postgres running, and five real Repos with their Issues stored in your database.

You need: Node.js 22.12 or newer, [pnpm](https://pnpm.io), [Docker](https://www.docker.com), and a GitHub account.

## 1. Clone and install

```sh
git clone https://github.com/salvar3nga/contribution-finder.git
cd contribution-finder
pnpm install
```

`pnpm install` also generates the Prisma client for `packages/db`.

## 2. Create a GitHub token

The ingest reads public data from the GitHub GraphQL API, so the token needs no permissions.

1. Open <https://github.com/settings/tokens> (Settings → Developer settings, at the bottom of the sidebar).
2. Choose **Fine-grained tokens → Generate new token**.
3. Under **Repository access** choose **Public repositories (read-only)** and leave permissions empty.
4. Generate it and copy the value. GitHub shows it only once.

## 3. Configure your environment

```sh
cp .env.example .env
```

Open `.env` and paste the token as the value of `GITHUB_TOKEN`. Leave the database URLs as they are: they match `docker-compose.yml`.

## 4. Start Postgres and create the tables

```sh
docker compose up -d
set -a; source .env; set +a
pnpm --filter @cf/db migrate
```

You should see the `init` migration applied.

## 5. Ingest five Repos

```sh
pnpm --filter @cf/ingest exec tsx --env-file=../../.env src/main.ts --max-repos 5
```

After about ten seconds the last log line reads like this:

```
Ingested 5 repos, 7 issues, 0 errors in 12042ms
```

The exact numbers differ, because GitHub's data changes.

## 6. Look at what was stored

```sh
docker compose exec db psql -U cf contribution_finder \
  -c 'select owner, name, stars, active from "Repo" where "ingestedAt" is not null;'
```

Some Repos show `active = f`. These have no open Issue labelled `good first issue` or `help wanted`, so they are not part of the active set. See [How ingest works](../explanation/how-ingest-works.md).

## 7. Run the checks

```sh
pnpm lint
pnpm typecheck
pnpm test
```

The tests use the `contribution_finder_test` database. If they fail because it does not exist, see [Troubleshooting](../how-to/troubleshoot.md).

## Next steps

- [Run the ingest locally](../how-to/run-ingest-locally.md) for day-to-day options.
- [Deploy the nightly ingest](../how-to/deploy-nightly-ingest.md) to run it on GitHub Actions with Neon.
- [How ingest works](../explanation/how-ingest-works.md) for the design.
