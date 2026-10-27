# Run the tests

## All tests

```sh
pnpm test
```

## One package or file

```sh
pnpm --filter @cf/scoring test
pnpm --filter @cf/ingest exec vitest run src/pipeline.test.ts
```

## Typecheck and lint

```sh
pnpm typecheck
pnpm lint
```

## What the ingest tests need

The ingest tests run the real pipeline against a real Postgres. They need:

- Postgres running (`docker compose up -d`).
- The database `contribution_finder_test`. Docker creates it the first time the volume is initialised.
- Optionally `TEST_DATABASE_URL` in the environment. It defaults to the Docker test database.

Before the tests start, vitest applies the migrations to the test database for you. Each test starts from truncated tables. The tests never call GitHub: the pipeline gets a fake `GitHubClient`.

See [Testing approach](../explanation/testing-approach.md).
