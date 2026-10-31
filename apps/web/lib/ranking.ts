import type { Issue, PrismaClient, Repo } from '@cf/db';
import {
  healthScore,
  matchScore,
  type HealthResult,
  type MatchComponent,
  type MatchInput,
  type MatchResult,
} from '@cf/scoring';

export const pageSize = 50;
const dayMs = 24 * 60 * 60 * 1000;

export type ScoringProfile = MatchInput['profile'];

export type ScoringRepo = Pick<
  Repo,
  'language' | 'topics' | 'medianFirstResponseHours' | 'lastCommitAt'
>;

export interface RankedIssue {
  issue: { id: string; number: number; title: string; claimed: boolean };
  repo: {
    owner: string;
    name: string;
    language: string | null;
    health: number | null;
  };
  matchScore: number | null;
  strengths: MatchComponent[];
}

export interface RankingOptions {
  language: string | null;
  page: number;
  now: Date;
}

export interface Ranking {
  items: RankedIssue[];
  total: number;
  page: number;
  pageCount: number;
  languages: string[];
  emptyProfile: boolean;
}

interface IssueFacts {
  claimed: boolean;
  lastActivityAt: Date;
}

export interface ScoredIssue {
  match: MatchResult;
  health: HealthResult;
}

export function scoreIssue(
  profile: ScoringProfile,
  repo: ScoringRepo,
  issue: IssueFacts,
  now: Date,
  health: HealthResult = healthScoreOf(repo, now),
): ScoredIssue {
  const match = matchScore({
    profile,
    issue: {
      repoLanguage: repo.language ?? '',
      repoTopics: repo.topics,
      repoHealth: health.score,
      daysSinceActivity: Math.max(
        0,
        (now.getTime() - issue.lastActivityAt.getTime()) / dayMs,
      ),
      claimed: issue.claimed,
    },
  });
  return { match, health };
}

export function healthScoreOf(repo: ScoringRepo, now: Date): HealthResult {
  return healthScore({
    medianFirstResponseHours: repo.medianFirstResponseHours,
    daysSinceLastCommit:
      repo.lastCommitAt === null
        ? null
        : Math.max(0, (now.getTime() - repo.lastCommitAt.getTime()) / dayMs),
  });
}

const strengthCount = 3;

function strengthsOf(match: MatchResult): MatchComponent[] {
  return match.breakdown
    .filter((entry) => (entry.contribution ?? 0) > 0)
    .sort((a, b) => b.contribution! - a.contribution!)
    .slice(0, strengthCount)
    .map((entry) => entry.component);
}

function byScoreThenRecency(a: RankedIssueRow, b: RankedIssueRow): number {
  const scoreDifference = (b.matchScore ?? -1) - (a.matchScore ?? -1);
  if (scoreDifference !== 0) return scoreDifference;
  const recency = b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
  return recency !== 0 ? recency : a.issue.id.localeCompare(b.issue.id);
}

interface RankedIssueRow extends RankedIssue {
  lastActivityAt: Date;
}

export type ActiveRepo = ScoringRepo &
  Pick<Repo, 'owner' | 'name'> & {
    issues: Pick<
      Issue,
      'id' | 'number' | 'title' | 'claimed' | 'lastActivityAt'
    >[];
  };

export function loadActiveRepos(db: PrismaClient): Promise<ActiveRepo[]> {
  return db.repo.findMany({
    where: { active: true },
    select: {
      owner: true,
      name: true,
      language: true,
      topics: true,
      lastCommitAt: true,
      medianFirstResponseHours: true,
      issues: {
        where: { state: 'open' },
        select: {
          id: true,
          number: true,
          title: true,
          claimed: true,
          lastActivityAt: true,
        },
      },
    },
  });
}

export function rankIssues(
  repos: ActiveRepo[],
  profile: ScoringProfile,
  { language, page, now }: RankingOptions,
): Ranking {
  const languages = [
    ...new Set(
      repos.flatMap((repo) => (repo.language === null ? [] : [repo.language])),
    ),
  ].sort();

  const wanted = language?.toLowerCase() ?? null;
  const rows: RankedIssueRow[] = repos
    .filter(
      (repo) => wanted === null || repo.language?.toLowerCase() === wanted,
    )
    .flatMap((repo) => {
      const health = healthScoreOf(repo, now);
      return repo.issues.map((issue) => {
        const { match } = scoreIssue(profile, repo, issue, now, health);
        return {
          issue: {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            claimed: issue.claimed,
          },
          repo: {
            owner: repo.owner,
            name: repo.name,
            language: repo.language,
            health: health.score,
          },
          matchScore: match.score,
          strengths: strengthsOf(match),
          lastActivityAt: issue.lastActivityAt,
        };
      });
    })
    .sort(byScoreThenRecency);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;

  return {
    items: rows
      .slice(start, start + pageSize)
      .map(({ issue, repo, matchScore, strengths }) => ({
        issue,
        repo,
        matchScore,
        strengths,
      })),
    total: rows.length,
    page: currentPage,
    pageCount,
    languages,
    emptyProfile: Object.keys(profile.languageShare).length === 0,
  };
}
