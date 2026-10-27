# Ingest config

Defined in `apps/ingest/src/config.ts` as `defaultIngestConfig`.

| Option                    | Default                                                        | Meaning                                                               |
| ------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `languages`               | TypeScript, JavaScript, Python, Java, Go, Rust, C#, PHP        | Languages to search for                                               |
| `starBands`               | 500–699, 700–999, 1000–1999, 2000–4999, 5000+                   | Star ranges. Each language × band is one search slice                 |
| `eligibleLabels`          | `good first issue`, `help wanted`                              | Labels that make an Issue eligible, matched case-insensitively        |
| `rateLimitFloor`          | 200                                                            | The run stops cleanly when GitHub reports fewer remaining points      |
| `activityWindowDays`      | 90                                                             | Window for first-response and first-time-contributor data             |
| `maxRecentItems`          | 50                                                             | Maximum Issues and PRs sampled for response time                      |
| `minItemsForResponseTime` | 5                                                              | Fewer responded items than this stores no response time               |
| `firstTimeAssociations`   | `FIRST_TIME_CONTRIBUTOR`, `FIRST_TIMER`                        | GitHub `authorAssociation` values counted as first-time contributors  |
| `maxErrorRate`            | 0.1                                                            | A per-Repo error rate above this makes the run fail                   |

## Fixed in the GitHub client

These live in `apps/ingest/src/graphql-client.ts`.

| Value                  | Setting                                          |
| ---------------------- | ------------------------------------------------ |
| Repo search page size  | 25                                               |
| Issue and PR page size | 100                                              |
| PR pages per Repo      | at most 10                                       |
| Retries                | 4 attempts on 5xx responses, with a growing delay |
