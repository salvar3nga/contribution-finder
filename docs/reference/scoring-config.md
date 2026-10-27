# Scoring config

Defined in `packages/scoring/src/config.ts` as `defaultScoringConfig`. A curve maps a value to 0–100: `full` is the value that scores 100, `zero` the value that scores 0.

## Health score

| Setting                    | Default           | Meaning                                                 |
| -------------------------- | ----------------- | ------------------------------------------------------- |
| `weights.responseTime`     | 0.4               | Maintainer response time                                |
| `weights.firstTimeMergeRate` | 0.4             | Share of first-time-contributor PRs that were merged    |
| `weights.recentCommits`    | 0.2               | Recent commit activity                                  |
| `responseHours`            | full 24, zero 336 | Median first response, in hours                         |
| `commitDays`               | full 7, zero 90   | Days since the last commit                              |
| `minFirstTimePrs`          | 3                 | Fewer settled first-time PRs means no data              |
| `minSignalsWithData`       | 2                 | Fewer signals with data gives a `null` Health score     |

## Match score

| Setting                | Default            | Meaning                         |
| ---------------------- | ------------------ | ------------------------------- |
| `weights.language`     | 0.35               | Language overlap                |
| `weights.health`       | 0.30               | Health score of the Repo        |
| `weights.topics`       | 0.15               | Topic overlap                   |
| `weights.freshness`    | 0.10               | Issue freshness                 |
| `weights.unclaimed`    | 0.10               | Unclaimed status                |
| `freshnessDays`        | full 30, zero 365  | Days since the Issue's activity |

Components with no data are dropped and the remaining weights are re-normalized. See the [Glossary](../../GLOSSARY.md).
