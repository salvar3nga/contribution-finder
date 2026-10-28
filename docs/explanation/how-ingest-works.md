# How ingest works

The ingest copies a slice of GitHub into Postgres, so the web app never has to call GitHub for Repo data. It runs every night, in two phases: refresh runs every night, while discovery runs only on Sundays (and on manual runs).

## Discovery

GitHub search returns at most 1,000 results per query. To reach every in-scope Repo, discovery slices the search by language and star band and follows pagination within each slice. Forks and archived Repos are excluded. Repos are keyed by GitHub id, so one found in two slices is stored once.

Each slice is also restricted to Repos with at least one open `good first issue` or `help wanted` Issue, using GitHub's `good-first-issues:>0` and `help-wanted-issues:>0` search qualifiers. Without them the search matches over 30,000 Repos, most of which have nothing to offer. Each slice is searched once per qualifier, and a Repo found by both is stored once.

Discovery is still the expensive phase, so it runs weekly. The other nights spend the whole budget on refresh.

## Refresh

For each stored Repo, oldest ingestion first (never-ingested Repos before all others), the ingest fetches:

- open Issues labelled `good first issue` or `help wanted`,
- up to 50 recent Issues and PRs (about half each), to measure how fast maintainers respond.

A Repo with no open eligible Issue is marked inactive, not deleted: it can become active again after a later refresh.

## Why the ordering gives you resumability

There is no checkpoint table. The ingestion time on each Repo is the checkpoint: an interrupted or rate-limited run leaves the untouched Repos with the oldest times, so the next run starts with them.

## Rate limits

Every GraphQL response reports `rateLimit { remaining }`. When it drops below the floor of 200, the run stops, writes its summary and exits 0. It does not sleep until the reset. A run that stops this way is a normal run, not a failure. A full cycle over a few thousand Repos takes several nights.

## When Issues are marked closed

An Issue is marked `closed` only when a _complete_ fetch of its Repo no longer returns it. If the fetch was cut short by the rate limit, nothing is marked closed, because a missing Issue could just be one we did not reach.

An Issue also stops being returned when its eligible label is removed, so it is closed in that case too.

## What is stored, and why only raw inputs

Health inputs are stored as raw values: median first-response hours and last commit date. The Health score is computed at query time from those, so changing the Scoring config needs no re-ingest.

## Definitions worth knowing

- **Claimed**: the Issue has an assignee, or an open pull request that would close it. Comments are not parsed.
- **Median first response**: over sampled Issues and PRs that received a response from someone other than the author. With fewer than five of them there is no value (`null`).

## Failure handling

A failure on one Repo is logged, counted and skipped. The run fails (non-zero exit) on a fatal error or when more than 10% of attempted Repos errored, so the Actions run shows red. A failed search during discovery is fatal.
