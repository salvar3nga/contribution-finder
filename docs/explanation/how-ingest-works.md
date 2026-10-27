# How ingest works

The ingest copies a slice of GitHub into Postgres, so the web app never has to call GitHub for Repo data. It runs every night, in two phases: refresh runs every night, while discovery runs only on Sundays (and on manual runs).

## Discovery

GitHub search returns at most 1,000 results per query. To reach 2–5k Repos, discovery slices the search by language and star band and follows pagination within each slice. Forks and archived Repos are excluded. Repos are keyed by GitHub id, so one found in two slices is stored once.

Discovery is expensive: about 1,600 requests for the default scope, a large part of a day's rate-limit budget. It therefore runs weekly. The other nights spend the whole budget on refresh.

## Refresh

For each stored Repo, oldest ingestion first (never-ingested Repos before all others), the ingest fetches:

- open Issues labelled `good first issue` or `help wanted`,
- up to 50 recent Issues and PRs, to measure how fast maintainers respond,
- PRs from the last 90 days, to count first-time contributors' PRs.

A Repo with no open eligible Issue is marked inactive, not deleted: it can become active again after a later refresh.

## Why the ordering gives you resumability

There is no checkpoint table. The ingestion time on each Repo is the checkpoint: an interrupted or rate-limited run leaves the untouched Repos with the oldest times, so the next run starts with them.

## Rate limits

Every GraphQL response reports `rateLimit { remaining }`. When it drops below the floor of 200, the run stops, writes its summary and exits 0. It does not sleep until the reset. A run that stops this way is a normal run, not a failure. A full cycle over a few thousand Repos takes several nights.

## When Issues are marked closed

An Issue is marked `closed` only when a *complete* fetch of its Repo no longer returns it. If the fetch was cut short by the rate limit, nothing is marked closed, because a missing Issue could just be one we did not reach.

An Issue also stops being returned when its eligible label is removed, so it is closed in that case too.

## What is stored, and why only raw inputs

Health inputs are stored as raw values: median first-response hours, first-time PR counts, last commit date. The Health score is computed at query time from those, so changing the Scoring config needs no re-ingest.

## Definitions worth knowing

- **Claimed**: the Issue has an assignee, or an open pull request that would close it. Comments are not parsed.
- **Median first response**: over sampled Issues and PRs that received a response from someone other than the author. With fewer than five of them there is no value (`null`).
- **First-time PRs**: only closed or merged PRs count, so open ones cannot drag the merge rate down.

## Failure handling

A failure on one Repo is logged, counted and skipped. The run fails (non-zero exit) on a fatal error or when more than 10% of attempted Repos errored, so the Actions run shows red. A failed search during discovery is fatal.
