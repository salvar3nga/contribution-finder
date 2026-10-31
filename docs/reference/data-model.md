# Data model

Defined in `packages/db/prisma/schema.prisma`. Identifiers are GitHub node ids, so a Repo found twice is stored once.

## `Repo`

| Field                      | Type       | Notes                                                       |
| -------------------------- | ---------- | ----------------------------------------------------------- |
| `id`                       | string, PK | GitHub node id                                              |
| `owner`, `name`            | string     | Unique together                                             |
| `language`                 | string?    | Primary language                                            |
| `stars`                    | int        |                                                             |
| `topics`                   | string[]   |                                                             |
| `lastCommitAt`             | datetime?  | Last commit on the default branch                           |
| `medianFirstResponseHours` | float?     | `null` when fewer than 5 sampled items got a response       |
| `active`                   | boolean    | Has at least one open eligible Issue after the last refresh |
| `ingestedAt`               | datetime?  | `null` until the first refresh. Drives the refresh order    |

## `Issue`

| Field            | Type              | Notes                                   |
| ---------------- | ----------------- | --------------------------------------- |
| `id`             | string, PK        | GitHub node id                          |
| `repoId`         | string, FK        | Deleting a Repo deletes its Issues      |
| `number`         | int               |                                         |
| `title`, `url`   | string            |                                         |
| `labels`         | string[]          | As GitHub returned them                 |
| `claimed`        | boolean           | Assigned, or has an open linked PR      |
| `state`          | `open` / `closed` | `closed` once a complete fetch omits it |
| `lastActivityAt` | datetime          |                                         |

## `Profile`

Cache of built Profiles, keyed by lowercased username. The nightly ingest deletes rows whose `builtAt` is more than 7 days old.

| Field           | Type                    | Notes                                                                   |
| --------------- | ----------------------- | ----------------------------------------------------------------------- |
| `username`      | string, PK              | Lowercased                                                              |
| `outcome`       | `profile` / `not_found` | Rate-limited outcomes are not stored                                    |
| `languageShare` | json?                   | Percent per language                                                    |
| `topics`        | string[]                |                                                                         |
| `emptyProfile`  | boolean                 |                                                                         |
| `builtAt`       | datetime                | Drives expiry and the hourly cap                                        |
| `requestedBy`   | string?                 | SHA-256 of the requester's address; drives the per-requester hourly cap |

## `IngestRun`

| Field                 | Type     |
| --------------------- | -------- |
| `id`                  | int, PK  |
| `startedAt`           | datetime |
| `durationMs`          | int      |
| `reposIngested`       | int      |
| `issuesIngested`      | int      |
| `errors`              | int      |
| `stoppedForRateLimit` | boolean  |

Only raw Health inputs are stored. The Health score is computed at query time, so scoring changes need no re-ingest.
