# contribution-finder

Find beginner-friendly open source issues that match your GitHub profile, ranked with a transparent score and a project health signal.

**Live demo: <https://contribution-finder.vercel.app>**. Enter a GitHub username to see ranked Issues. The first lookup for a username can take a few seconds while the Profile is built.

## How it works

- A scheduled **ingest** job copies Repos and their `good first issue` / `help wanted` Issues from the GitHub GraphQL API into Postgres.
- The web app builds a **Profile** from a username (languages and topics from your public activity in the last 12 months) and caches it in Postgres.
- A rule-based **Match score** ranks every Issue against the Profile from five weighted components: language, repo health, topics, freshness and whether the Issue is unclaimed.
- The **Health score** of a Repo comes from how quickly maintainers respond and how recently they committed. A Repo with too little data shows "not enough data" instead of a guess.
- Every score shows its per-component breakdown on the Issue page. Weights and thresholds live in one config file ([scoring reference](docs/reference/scoring-config.md)).

## Stack

Next.js and TypeScript, Postgres with Prisma, a pnpm monorepo (`apps/web`, `apps/ingest`, `packages/*`), Vitest and Playwright. Deployed on Vercel with Neon Postgres; the ingest runs nightly on GitHub Actions.

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

Start with [Getting started](docs/tutorials/getting-started.md). The [docs](docs/) follow the Diátaxis framework: tutorials, how-to guides, reference and explanation. To run the nightly ingest against Neon, see [Deploy the nightly ingest](docs/how-to/deploy-nightly-ingest.md).

## License

MIT
