# Change the ingest scope

All scope settings live in `apps/ingest/src/config.ts` (`defaultIngestConfig`). No other file needs to change.

## Add or remove a language

Edit `languages`. Use the name GitHub shows, such as `'C#'` or `'TypeScript'`. Each language adds one search slice per star band.

## Change the star bands

Edit `starBands`. GitHub search returns at most 1,000 results per query, so keep each band narrow enough that a language does not hit the cap. The last band can use `maxStars: null` for "no upper limit".

## Change which labels make an Issue eligible

Edit `eligibleLabels`. Write them in lowercase: Issue labels are lowercased before the comparison, and the GitHub search matches case-insensitively.

## Change the rate-limit floor

Edit `rateLimitFloor`. The run stops cleanly when GitHub reports fewer remaining points than this.

## After changing the scope

Run a discovery pass (a manual workflow run, or a run without `--skip-discovery`) so new slices are searched. Repos already stored are never deleted. Ones that fall out of scope stay in the database and keep being refreshed until you remove them yourself.

See the [ingest config reference](../reference/ingest-config.md) for every option.
