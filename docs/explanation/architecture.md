# Architecture

contribution-finder matches a GitHub user to open beginner-friendly Issues. It has two halves that share one Postgres database and never talk to each other directly:

- the **ingest**, a nightly job that copies Repos and Issues from GitHub into Postgres,
- the **web app**, which reads Postgres, builds a Profile from a username and ranks Issues against it.

Terms such as Repo, Issue, Profile and Match score are defined in the [Glossary](../../GLOSSARY.md).

## System context

```mermaid
flowchart LR
    visitor([Visitor])
    web["Web app<br/>Next.js on Vercel"]
    ingest["Nightly ingest<br/>GitHub Actions"]
    db[("Postgres<br/>")]
    github["GitHub GraphQL API"]

    visitor -- "enters a GitHub username" --> web
    web -- "reads Repos and Issues<br/>reads and writes Profiles" --> db
    web -- "builds a Profile<br/>on a cache miss" --> github
    ingest -- "discovers and refreshes<br/>Repos and Issues" --> github
    ingest -- "writes Repos, Issues<br/>and run summaries" --> db
```

The web app only calls GitHub to build a Profile for the visitor. Repo and Issue data always comes from Postgres, so a page view never depends on GitHub's availability or search limits.

## Workspace structure

The monorepo splits runnable apps from shared packages. Dependencies point one way: apps depend on packages, and packages never depend on apps.

```mermaid
flowchart TB
    subgraph apps
        web["@cf/web"]
        ingest["@cf/ingest"]
    end
    subgraph packages
        profile["@cf/profile"]
        scoring["@cf/scoring"]
        dbpkg["@cf/db"]
    end

    web --> profile
    web --> scoring
    web --> dbpkg
    ingest --> dbpkg
    profile --> dbpkg
```

| Package       | Responsibility                                                       |
| ------------- | -------------------------------------------------------------------- |
| `@cf/db`      | Prisma schema, migrations and `createDb()`. The only owner of tables |
| `@cf/scoring` | Health score and Match score as pure functions, plus Scoring config  |
| `@cf/profile` | Builds a Profile from GitHub, with caching and rate limiting         |
| `@cf/web`     | Screens, ranking and Issue detail                                    |
| `@cf/ingest`  | Discovery, refresh and Profile pruning                               |

`@cf/scoring` depends on nothing, so it can be tested with plain inputs. See the [repository layout](../reference/repository-layout.md) for files.

## Data model

```mermaid
erDiagram
    Repo ||--o{ Issue : has
    Repo {
        string id PK "GitHub node id"
        string owner
        string name
        string language
        int stars
        string[] topics
        datetime lastCommitAt
        float medianFirstResponseHours
        boolean active
        datetime ingestedAt
    }
    Issue {
        string id PK "GitHub node id"
        string repoId FK
        int number
        string title
        string url
        string[] labels
        boolean claimed
        enum state "open or closed"
        datetime lastActivityAt
    }
    Profile {
        string username PK "lowercased"
        enum outcome "profile or not_found"
        json languageShare
        string[] topics
        boolean emptyProfile
        datetime builtAt
        string requestedBy "SHA-256 of address"
    }
    IngestRun {
        int id PK
        datetime startedAt
        int durationMs
        int reposIngested
        int issuesIngested
        int errors
        boolean stoppedForRateLimit
    }
```

`Profile` and `IngestRun` are standalone: nothing references them. Field details are in the [data model reference](../reference/data-model.md).

Only raw Health inputs are stored (`medianFirstResponseHours`, `lastCommitAt`). Scores are computed at read time, which is why changing the Scoring config needs no re-ingest.

## Ingest

The [ingest](how-ingest-works.md) runs from `.github/workflows/ingest.yml` at 03:00 UTC: discovery and refresh on Sundays and manual runs, refresh only on the other days.

```mermaid
sequenceDiagram
    participant Cron as GitHub Actions
    participant Main as main.ts
    participant Pipe as pipeline.ts
    participant GH as GitHub GraphQL
    participant DB as Postgres

    Cron->>Main: start (migrate first)
    Main->>Pipe: runIngest
    opt discovery enabled
        loop language x star band x issue qualifier
            Pipe->>GH: searchRepos(slice, cursor)
            GH-->>Pipe: repos, rateLimit
            Pipe->>DB: upsert Repo
        end
    end
    Pipe->>DB: Repos, oldest ingestedAt first
    loop each Repo, concurrently
        Pipe->>GH: fetchRepoActivity(repo, since)
        GH-->>Pipe: open Issues, recent items, rateLimit
        Pipe->>DB: transaction: update Repo, upsert Issues, close missing Issues
    end
    Pipe->>DB: insert IngestRun
    Main->>DB: delete Profiles older than 7 days
    Main-->>Cron: exit 0, or 1 on fatal error or error rate above 10%
```

The pipeline talks to GitHub only through the `GitHubClient` interface, so tests substitute a fake client. See the [testing approach](testing-approach.md).

## Request flow

Both screens that depend on a username (Results and Issue detail) follow the same path.

```mermaid
sequenceDiagram
    actor V as Visitor
    participant P as Page (Server Component)
    participant PS as profile-source
    participant PB as Profile builder
    participant DB as Postgres
    participant GH as GitHub GraphQL
    participant R as ranking.ts
    participant S as @cf/scoring

    V->>P: GET /u/username
    P->>PS: getProfileOutcome(username)
    PS->>PB: buildProfile(username, requester)
    PB->>DB: read cached Profile
    alt fresh cache hit
        DB-->>PB: Profile
    else miss or expired
        PB->>DB: count recent builds (global, per requester)
        alt over a limit
            PB-->>P: rate-limited
        else under limits
            PB->>GH: fetchRecentActivity (last 12 months)
            GH-->>PB: owned repos, merged PR repos
            PB->>DB: store Profile or not_found
        end
    end
    PB-->>P: profile, not-found or rate-limited
    P->>R: rankIssues(active Repos, profile)
    R->>S: healthScore, matchScore per Issue
    S-->>R: scores and breakdowns
    R-->>P: sorted, filtered, paginated page
    P-->>V: HTML
```

Active Repos with their open Issues are loaded once and cached for a few minutes (`'use cache'` with `cacheLife('minutes')` in `active-repos.ts`). Scoring and sorting then happen in memory per request.

## Profile builder

The builder protects the GitHub token budget with three layers before it makes a call.

```mermaid
flowchart TD
    start([buildProfile]) --> cache{"Cached outcome<br/>still fresh?"}
    cache -- "yes" --> hit([Return cached])
    cache -- "no" --> global{"800 builds<br/>in the last hour?"}
    global -- "yes" --> limited([rate-limited])
    global -- "no" --> perRequester{"Requester at 20 builds<br/>in the last hour?"}
    perRequester -- "yes" --> limited
    perRequester -- "no" --> fetch["Fetch last 12 months<br/>of activity"]
    fetch --> failure{"GitHub rate limit?"}
    failure -- "yes" --> limited
    failure -- "no" --> found{"User exists?"}
    found -- "no" --> notFound["Store not_found"]
    found -- "yes" --> build["Store Profile"]
    notFound --> done([Return outcome])
    build --> done
```

| Outcome        | Cached for | Stored |
| -------------- | ---------- | ------ |
| `profile`      | 24 hours   | yes    |
| `not-found`    | 1 hour     | yes    |
| `rate-limited` | not cached | no     |

The Requester is a SHA-256 hash of the forwarded address, so the database never holds a raw IP. The reasoning is in [ADR 002](../adr/002-profile-rate-limit-strategy.md).

## Scoring

Both scores are weighted sums of normalized components. A component with no input is dropped and the remaining weights are re-normalized.

```mermaid
flowchart LR
    config["Scoring config<br/>weights and curves"]
    subgraph repo["Repo facts"]
        response["Median first response"]
        commit["Days since last commit"]
    end
    subgraph issue["Issue facts"]
        freshness["Days since activity"]
        claimed["Claimed"]
    end
    subgraph profile["Profile"]
        languages["Language share"]
        topics["Topics"]
    end

    response --> health["Health score<br/>0 to 100"]
    commit --> health
    health --> match["Match score<br/>0 to 100"]
    freshness --> match
    claimed --> match
    languages --> match
    topics --> match
    config -.-> health
    config -.-> match
    health --> breakdown["Score breakdown"]
    match --> breakdown
```

The Health score is computed first and fed into the Match score as one of its components. Weights and curves live in `packages/scoring/src/config.ts`; see the [scoring config reference](../reference/scoring-config.md).

## Deployment

```mermaid
flowchart LR
    subgraph github["GitHub"]
        repo["Repository"]
        ci["CI workflow<br/>lint, typecheck, test, e2e"]
        nightly["Ingest workflow<br/>cron 03:00 UTC"]
    end
    vercel["Vercel<br/>Next.js app"]
    DB[("Postgres DB")]

    repo -- "pull request or push to main" --> ci
    repo -- "deploy" --> vercel
    nightly -- "migrate, then ingest" --> DB
    vercel -- "DATABASE_URL" --> DB
```

Secrets and variables per environment are listed in the [environment variables reference](../reference/environment-variables.md). The workflows are described in [GitHub Actions workflows](../reference/workflows.md).

## Design decisions

| Decision                                        | Reason                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Ingest into Postgres instead of querying GitHub | GitHub search caps at 1,000 results and rate limits would make page views unreliable |
| Store raw inputs, compute scores at read time   | Scoring changes need no re-ingest                                                    |
| Ingestion time as the checkpoint                | A rate-limited run resumes on its own the next night, with no extra table            |
| One `GitHubClient` seam                         | Tests run the real pipeline against a real database with a fake network              |
| Username only, no OAuth                         | Public activity is enough to build a Profile, and visitors need no account           |
| Hashed Requester key                            | Enforces a per-visitor limit without storing addresses                               |
