# Change the scoring weights

Both scores read their weights from `packages/scoring/src/config.ts` (`defaultScoringConfig`).

1. Edit the value, for example `match.weights.language`.
2. Run `pnpm --filter @cf/scoring test`.

Weights are relative: components that have no data are dropped and the remaining weights are re-normalized, so they do not need to sum to 1.

Because the ingest stores only raw Health inputs, a weight change takes effect immediately. You do not need to re-ingest.

See [Scoring config reference](../reference/scoring-config.md) for every setting and its default.
