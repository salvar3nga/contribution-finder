# Repository layout

```
apps/
  web/                 Next.js app: Home, Results, Issue detail. Reads Postgres; builds Profiles via @cf/profile
    lib/ranking.ts       load, score, sort, filter, paginate Issues
    e2e/                 Playwright smoke test
  ingest/              Nightly ingest job
    src/main.ts          CLI entry point and exit codes
    src/pipeline.ts      discovery, refresh, run summary
    src/github-client.ts the GitHubClient interface (the test seam)
    src/graphql-client.ts the real GitHub GraphQL adapter
    src/config.ts        ingest scope and thresholds
    src/test-support/    fake client, test database helpers, fixtures
packages/
  db/                  Prisma schema, migrations, createDb()
  profile/             Profile builder, cache, GitHub user client
  scoring/             Health score and Match score (pure functions) and config
docker-compose.yml     Local Postgres, plus the test database
.github/workflows/     CI and the nightly ingest
docs/                  This documentation
GLOSSARY.md            Domain terms
```

The Prisma client is generated into `packages/db/src/generated` (gitignored) by `pnpm install`.
