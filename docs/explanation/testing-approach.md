# Testing approach

## One seam for GitHub

The ingest talks to GitHub through the small `GitHubClient` interface in `apps/ingest/src/github-client.ts`: search Repos, fetch a Repo's activity. Everything above it is the ingest's own logic; everything below it is the network.

Tests inject a fake client and run the real pipeline against a real Postgres (`contribution_finder_test`). This tests behaviour, such as "re-running produces no duplicates" or "an incomplete fetch never closes Issues", without mocking the database or reaching into internals.

## One test for the real adapter

`graphql-client.test.ts` checks the GraphQL adapter against fixed responses stored in `src/test-support/fixtures/`. These fixtures were written by hand in GitHub's response shape; they are not recordings. They prove the mapping, not that GitHub accepts the queries. A run with a real token (`--max-repos 5`) is the check for that.

## Scoring

`packages/scoring` is pure functions, tested directly with plain inputs.

## Conventions

- Tests are written first, one behaviour at a time.
- Code and tests carry no comments: names should explain intent.
