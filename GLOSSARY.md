# Glossary

Domain terms used across code, specs, and docs. Use these names exactly.

| Term                | Definition                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Issue**           | A GitHub issue ingested into our database that carries a beginner-friendly label (`good first issue` or `help wanted`).                                                                                        |
| **Repo**            | A GitHub repository in the ingest scope: 500+ stars, one of the 8 supported languages, at least one eligible Issue.                                                                                            |
| **Profile**         | A snapshot of a GitHub user's public activity (languages, topics, repos touched), built from a username. No login required.                                                                                    |
| **Empty Profile**   | A Profile with no languages (no public activity). Language and topic overlap are "no data"; the Match result carries an `emptyProfile` flag so the UI can say so.                                              |
| **Requester**       | The client that triggered a Profile build, identified by a SHA-256 hash of its forwarded address. Each Requester gets 20 uncached Profile builds per hour.                                                     |
| **Ingest**          | The nightly job that pulls Repos and Issues from the GitHub GraphQL API into Postgres.                                                                                                                         |
| **Match score**     | 0–100 rule-based score of how well an Issue fits a Profile: language overlap, topic overlap, Issue freshness, Health score, and unclaimed status. `null` if no component carries weight in the Scoring config. |
| **Health score**    | 0–100 score of how welcoming and active a Repo is. Combines two normalized Health signals; `null` if fewer than two have data.                                                                                 |
| **Health signal**   | One Repo-level input to the Health score: maintainer response time or recent commit activity.                                                                                                                  |
| **Claimed**         | An Issue that is assigned or has an open linked PR. An Issue-level component of the Match score; Claimed Issues rank lower but are never hidden.                                                               |
| **No data**         | A score component with no usable input. It is dropped and the remaining weights are re-normalized; the Score breakdown marks it.                                                                               |
| **Score breakdown** | The per-component contributions shown to the user for a Match score or Health score.                                                                                                                           |
| **Scoring config**  | The file holding the weights for both scores. Changing it must not require code changes elsewhere.                                                                                                             |
