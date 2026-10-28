# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers, often early in their open-source journey, looking for a first or next contribution that fits what they already work on. They arrive with a GitHub username and want a short, trustworthy list. Also a public portfolio piece, so reviewers read the code and the product.

## Product Purpose

Matches a GitHub user to beginner-friendly Issues (`good first issue`, `help wanted`) from healthy Repos, ranked by a rule-based Match score whose breakdown is always visible. Success: the user opens an Issue on GitHub with confidence about why it was suggested.

## Positioning

Every ranking is explained: Match score and Health score show per-component contributions, and missing data is labelled "no data", never scored as zero. No login, username only.

## Capabilities and Constraints

- Three screens: Home, Results (language filter, 50 per page), Issue detail. Plus not found, rate-limited and error states.
- Terms from GLOSSARY.md are used exactly: Issue, Repo, Profile, Empty Profile, Match score, Health score, Claimed, No data, Score breakdown.
- Reads Postgres only, except building a Profile from GitHub.

## Product Principles

- Show the reasoning, not just the rank.
- Honest about missing data.
- Claimed Issues are never hidden, only ranked lower.
- Task first: scanning a list quickly beats decoration.

## Accessibility & Inclusion

Fully keyboard-operable, WCAG AA contrast, works at phone width, light and dark.
