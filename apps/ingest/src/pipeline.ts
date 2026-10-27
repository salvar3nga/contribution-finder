import { IssueState, type PrismaClient } from '@cf/db';
import { defaultIngestConfig, type IngestConfig } from './config.js';
import type {
  DiscoveredRepo,
  GitHubClient,
  RateLimit,
  RecentItem,
  RecentPullRequest,
  RepoIssue,
} from './github-client.js';

export interface IngestOptions {
  client: GitHubClient;
  db: PrismaClient;
  config?: IngestConfig;
  now: Date;
  maxRepos?: number;
  discover?: boolean;
  log: (message: string) => void;
}

export interface IngestSummary {
  attemptedRepos: number;
  reposIngested: number;
  issuesIngested: number;
  errors: number;
  durationMs: number;
  stoppedForRateLimit: boolean;
}

interface RefreshResult {
  issuesIngested: number;
  rateLimit: RateLimit;
}

function isEligible(issue: RepoIssue, config: IngestConfig): boolean {
  return issue.labels.some((label) =>
    config.eligibleLabels.includes(label.toLowerCase()),
  );
}

interface RunState {
  stoppedForRateLimit: boolean;
}

function belowFloor(rateLimit: RateLimit, config: IngestConfig): boolean {
  return rateLimit.remaining < config.rateLimitFloor;
}

async function discoverRepos(
  options: IngestOptions,
  state: RunState,
): Promise<void> {
  const { client, db, config = defaultIngestConfig, maxRepos, log } = options;
  let discovered = 0;
  for (const language of config.languages) {
    for (const band of config.starBands) {
      let cursor: string | null = null;
      do {
        if (state.stoppedForRateLimit) return;
        if (maxRepos !== undefined && discovered >= maxRepos) return;
        const { value, rateLimit } = await client.searchRepos(
          { language, ...band },
          cursor,
        );
        for (const repo of value.repos.filter(isInScope)) {
          await upsertDiscovered(db, repo);
          discovered += 1;
        }
        state.stoppedForRateLimit = belowFloor(rateLimit, config);
        log(
          `Discovery ${language} ${band.minStars}+ stars: ${discovered} repos found so far`,
        );
        cursor = value.nextCursor;
      } while (cursor !== null);
    }
  }
}

function isInScope(repo: DiscoveredRepo): boolean {
  return !repo.isFork && !repo.isArchived;
}

async function upsertDiscovered(
  db: PrismaClient,
  repo: DiscoveredRepo,
): Promise<void> {
  const fields = {
    owner: repo.owner,
    name: repo.name,
    language: repo.language,
    stars: repo.stars,
    topics: repo.topics,
    lastCommitAt: repo.lastCommitAt,
  };
  await db.repo.upsert({
    where: { id: repo.id },
    create: { id: repo.id, ...fields },
    update: fields,
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function medianFirstResponseHours(
  items: RecentItem[],
  config: IngestConfig,
): number | null {
  const responseHours = items.flatMap((item) =>
    item.firstResponseAt
      ? [
          (item.firstResponseAt.getTime() - item.createdAt.getTime()) /
            3_600_000,
        ]
      : [],
  );
  return responseHours.length < config.minItemsForResponseTime
    ? null
    : median(responseHours);
}

function firstTimePrCounts(
  pullRequests: RecentPullRequest[],
  config: IngestConfig,
): { total: number; merged: number } {
  const settled = pullRequests.filter(
    (pr) =>
      config.firstTimeAssociations.includes(pr.authorAssociation) &&
      pr.state !== 'OPEN',
  );
  return {
    total: settled.length,
    merged: settled.filter((pr) => pr.state === 'MERGED').length,
  };
}

async function refreshRepo(
  options: IngestOptions,
  repo: { id: string; owner: string; name: string },
): Promise<RefreshResult> {
  const { client, db, config = defaultIngestConfig, now } = options;
  const since = new Date(
    now.getTime() - config.activityWindowDays * 24 * 60 * 60 * 1000,
  );
  const { value: activity, rateLimit } = await client.fetchRepoActivity(
    repo,
    since,
  );
  const eligible = activity.openIssues.filter((issue) =>
    isEligible(issue, config),
  );
  const firstTimePrs = firstTimePrCounts(activity.recentPullRequests, config);
  await db.$transaction(async (tx) => {
    await tx.repo.update({
      where: { id: repo.id },
      data: {
        active: eligible.length > 0,
        ingestedAt: now,
        medianFirstResponseHours: medianFirstResponseHours(
          activity.recentItems,
          config,
        ),
        firstTimePrsTotal: firstTimePrs.total,
        firstTimePrsMerged: firstTimePrs.merged,
      },
    });
    for (const issue of eligible) {
      const fields = {
        number: issue.number,
        title: issue.title,
        url: issue.url,
        labels: issue.labels,
        claimed: issue.assigneeCount > 0 || issue.openLinkedPrCount > 0,
        state: IssueState.open,
        lastActivityAt: issue.lastActivityAt,
      };
      await tx.issue.upsert({
        where: { id: issue.id },
        create: { id: issue.id, repoId: repo.id, ...fields },
        update: fields,
      });
    }
    if (activity.complete) {
      await tx.issue.updateMany({
        where: {
          repoId: repo.id,
          state: IssueState.open,
          id: { notIn: eligible.map((issue) => issue.id) },
        },
        data: { state: IssueState.closed },
      });
    }
  });
  return { issuesIngested: eligible.length, rateLimit };
}

export function shouldFail(
  summary: IngestSummary,
  config: IngestConfig,
): boolean {
  return (
    summary.attemptedRepos > 0 &&
    summary.errors / summary.attemptedRepos > config.maxErrorRate
  );
}

export async function runIngest(
  options: IngestOptions,
): Promise<IngestSummary> {
  const {
    db,
    config = defaultIngestConfig,
    now,
    maxRepos,
    discover = true,
    log,
  } = options;
  const startedAtMs = Date.now();
  const state: RunState = { stoppedForRateLimit: false };
  const summary: IngestSummary = {
    attemptedRepos: 0,
    reposIngested: 0,
    issuesIngested: 0,
    errors: 0,
    durationMs: 0,
    stoppedForRateLimit: false,
  };
  if (discover) await discoverRepos(options, state);
  const repos = state.stoppedForRateLimit
    ? []
    : await db.repo.findMany({
        orderBy: [
          { ingestedAt: { sort: 'asc', nulls: 'first' } },
          { id: 'asc' },
        ],
        take: maxRepos,
      });
  for (const repo of repos) {
    summary.attemptedRepos += 1;
    try {
      const result = await refreshRepo(options, repo);
      summary.reposIngested += 1;
      summary.issuesIngested += result.issuesIngested;
      if (summary.attemptedRepos % 100 === 0) {
        log(`Refreshed ${summary.attemptedRepos} of ${repos.length} repos`);
      }
      if (belowFloor(result.rateLimit, config)) {
        state.stoppedForRateLimit = true;
        break;
      }
    } catch (error) {
      summary.errors += 1;
      log(`Failed to ingest ${repo.owner}/${repo.name}: ${String(error)}`);
    }
  }
  summary.stoppedForRateLimit = state.stoppedForRateLimit;
  summary.durationMs = Date.now() - startedAtMs;
  await db.ingestRun.create({
    data: {
      startedAt: now,
      durationMs: summary.durationMs,
      reposIngested: summary.reposIngested,
      issuesIngested: summary.issuesIngested,
      errors: summary.errors,
      stoppedForRateLimit: summary.stoppedForRateLimit,
    },
  });
  log(
    `Ingested ${summary.reposIngested} repos, ${summary.issuesIngested} issues, ${summary.errors} errors in ${summary.durationMs}ms` +
      (summary.stoppedForRateLimit ? ' (stopped for rate limit)' : ''),
  );
  return summary;
}
