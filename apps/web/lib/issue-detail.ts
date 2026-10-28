import type { Issue, PrismaClient, Repo } from '@cf/db';
import type { HealthResult, MatchResult } from '@cf/scoring';
import { scoreIssue, type ScoringProfile } from './ranking';

export interface IssueReference {
  owner: string;
  repo: string;
  number: number;
}

export interface IssueDetail {
  issue: Issue;
  repo: Repo;
  match: MatchResult;
  health: HealthResult;
}

export async function findIssueDetail(
  db: PrismaClient,
  profile: ScoringProfile,
  { owner, repo: name, number }: IssueReference,
  now: Date,
): Promise<IssueDetail | null> {
  const repo = await db.repo.findUnique({
    where: { owner_name: { owner, name } },
    include: { issues: { where: { number } } },
  });
  if (!repo) return null;
  const { issues, ...repoFacts } = repo;
  const issue = issues[0];
  if (!issue) return null;
  return {
    issue,
    repo: repoFacts,
    ...scoreIssue(profile, repoFacts, issue, now),
  };
}
