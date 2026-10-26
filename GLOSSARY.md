# Glossary

Domain terms used across code, specs, and docs. Use these names exactly.

| Term                | Definition                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Issue**           | A GitHub issue ingested into our database that carries a beginner-friendly label (`good first issue` or `help wanted`).                          |
| **Repo**            | A GitHub repository in the ingest scope: 500+ stars, one of the 8 supported languages, at least one eligible Issue.                              |
| **Profile**         | A snapshot of a GitHub user's public activity (languages, topics, repos touched), built from a username. No login required.                      |
| **Ingest**          | The nightly job that pulls Repos and Issues from the GitHub GraphQL API into Postgres.                                                           |
| **Match score**     | 0–100 rule-based score of how well an Issue fits a Profile: language overlap, topic overlap, Issue freshness, Health score, and unclaimed status. |
| **Health score**    | 0–100 score of how welcoming and active a Repo is. Combines three normalized Health signals; `null` if fewer than two have data.                 |
| **Health signal**   | One Repo-level input to the Health score: maintainer response time, first-time-contributor merge rate (90 days), or recent commit activity.      |
| **Claimed**         | An Issue that is assigned or has an open linked PR. An Issue-level component of the Match score; Claimed Issues rank lower but are never hidden. |
| **No data**         | A score component with no usable input. It is dropped and the remaining weights are re-normalized; the Score breakdown marks it.                 |
| **Score breakdown** | The per-component contributions shown to the user for a Match score or Health score.                                                             |
| **Scoring config**  | The file holding the weights for both scores. Changing it must not require code changes elsewhere.                                               |
