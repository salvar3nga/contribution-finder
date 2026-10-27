# contribution-finder

Find beginner-friendly open source issues that match your GitHub profile, ranked with a transparent score and a project health signal.

> Work in progress.

## How it works

- A scheduled **ingest** job copies Repos and their `good first issue` / `help wanted` Issues from the GitHub GraphQL API into Postgres.
- A rule-based **Match score** and **Health score** rank them, and show the per-component breakdown.
- A Next.js web app reads from Postgres.

## Quick start

Requires Node.js 22.12+, [pnpm](https://pnpm.io) and Docker.

```sh
pnpm install
cp .env.example .env
docker compose up -d
set -a; source .env; set +a
pnpm --filter @cf/db migrate
```

Add a GitHub token (no permissions needed) as `GITHUB_TOKEN` in `.env`, then ingest a few Repos:

```sh
pnpm --filter @cf/ingest exec tsx --env-file=../../.env src/main.ts --max-repos 5
```

Start the web app with `pnpm dev`. Check the code with `pnpm lint`, `pnpm typecheck` and `pnpm test`.

## Documentation

Start with [Getting started](docs/tutorials/getting-started.md). The [docs](docs/) follow the Diátaxis framework: tutorials, how-to guides, reference and explanation.

## License

MIT
