import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@cf/db';
import { defaultIngestConfig } from './config.js';
import { runIngest, shouldFail } from './pipeline.js';
import {
  aRepo,
  anActivity,
  anIssue,
  fakeGitHub,
  type FakeGitHub,
} from './test-support/fake-github.js';
import { createCleanTestDb } from './test-support/database.js';

const now = new Date('2026-10-27T03:00:00Z');
const oneSliceConfig = {
  ...defaultIngestConfig,
  languages: ['TypeScript'],
  starBands: [{ minStars: 500, maxStars: null }],
};

let db: PrismaClient;

beforeEach(async () => {
  db = await createCleanTestDb();
});

afterAll(async () => {
  await db.$disconnect();
});

function ingest(client: FakeGitHub, options: { maxRepos?: number } = {}) {
  return runIngest({
    client,
    db,
    config: oneSliceConfig,
    now,
    log: () => {},
    ...options,
  });
}

describe('storing repos and issues', () => {
  it('stores an eligible repo with its open eligible issues', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha', { stars: 900, topics: ['cli', 'tooling'] })],
      activity: {
        alpha: anActivity({
          openIssues: [
            anIssue('1', {
              title: 'Fix typo',
              labels: ['Help Wanted', 'docs'],
            }),
          ],
        }),
      },
    });

    await ingest(client);

    const repo = await db.repo.findUniqueOrThrow({
      where: { id: 'repo-alpha' },
      include: { issues: true },
    });
    expect(repo).toMatchObject({
      owner: 'acme',
      name: 'alpha',
      language: 'TypeScript',
      stars: 900,
      topics: ['cli', 'tooling'],
      active: true,
      ingestedAt: now,
    });
    expect(repo.issues).toHaveLength(1);
    expect(repo.issues[0]).toMatchObject({
      title: 'Fix typo',
      labels: ['Help Wanted', 'docs'],
      state: 'open',
    });
  });

  it('produces no duplicates when run twice', async () => {
    const client = fakeGitHub({ repos: [aRepo('alpha')] });

    await ingest(client);
    await ingest(fakeGitHub({ repos: [aRepo('alpha')] }));

    expect(await db.repo.count()).toBe(1);
    expect(await db.issue.count()).toBe(1);
  });

  it('follows search pagination within a slice', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha'), aRepo('bravo'), aRepo('charlie')],
      searchPageSize: 1,
    });

    await ingest(client);

    expect(await db.repo.count()).toBe(3);
  });

  it('stores a repo found in two slices once', async () => {
    const client = fakeGitHub({ repos: [aRepo('alpha'), aRepo('alpha')] });

    await ingest(client);

    expect(await db.repo.count()).toBe(1);
  });
});

describe('active set', () => {
  it('excludes forks and archived repos', async () => {
    const client = fakeGitHub({
      repos: [
        aRepo('forked', { isFork: true }),
        aRepo('old', { isArchived: true }),
        aRepo('good'),
      ],
    });

    await ingest(client);

    expect(client.fetchedRepoNames).toEqual(['good']);
    expect(await db.repo.findMany({ select: { name: true } })).toEqual([
      { name: 'good' },
    ]);
  });

  it('marks a repo with no open eligible issue inactive', async () => {
    const client = fakeGitHub({
      repos: [aRepo('quiet')],
      activity: {
        quiet: anActivity({
          openIssues: [anIssue('1', { labels: ['bug'] })],
        }),
      },
    });

    await ingest(client);

    const repo = await db.repo.findUniqueOrThrow({
      where: { id: 'repo-quiet' },
      include: { issues: true },
    });
    expect(repo.active).toBe(false);
    expect(repo.issues).toEqual([]);
  });
});

describe('claimed issues', () => {
  it('flags assigned issues and issues with an open linked PR as claimed', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha')],
      activity: {
        alpha: anActivity({
          openIssues: [
            anIssue('1', { assigneeCount: 1 }),
            anIssue('2', { openLinkedPrCount: 1 }),
            anIssue('3'),
          ],
        }),
      },
    });

    await ingest(client);

    const claimedByNumber = Object.fromEntries(
      (await db.issue.findMany()).map((issue) => [issue.number, issue.claimed]),
    );
    expect(claimedByNumber).toEqual({ 1: true, 2: true, 3: false });
  });
});

describe('health inputs', () => {
  const hoursAfter = (hours: number) =>
    new Date(new Date('2026-10-01T00:00:00Z').getTime() + hours * 3_600_000);
  const respondedItem = (hours: number) => ({
    createdAt: hoursAfter(0),
    firstResponseAt: hoursAfter(hours),
  });

  async function storedAlpha() {
    return db.repo.findUniqueOrThrow({ where: { id: 'repo-alpha' } });
  }

  it('stores the median first response time in hours', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha')],
      activity: {
        alpha: anActivity({
          recentItems: [2, 4, 10, 30, 100].map(respondedItem),
        }),
      },
    });

    await ingest(client);

    expect((await storedAlpha()).medianFirstResponseHours).toBe(10);
  });

  it('stores no response time when fewer than 5 items got a response', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha')],
      activity: {
        alpha: anActivity({
          recentItems: [
            ...[2, 4, 10, 30].map(respondedItem),
            { createdAt: hoursAfter(0), firstResponseAt: null },
          ],
        }),
      },
    });

    await ingest(client);

    expect((await storedAlpha()).medianFirstResponseHours).toBeNull();
  });

  it('counts first-time-contributor PRs only when closed or merged', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha')],
      activity: {
        alpha: anActivity({
          recentPullRequests: [
            { authorAssociation: 'FIRST_TIME_CONTRIBUTOR', state: 'MERGED' },
            { authorAssociation: 'FIRST_TIMER', state: 'CLOSED' },
            { authorAssociation: 'FIRST_TIMER', state: 'OPEN' },
            { authorAssociation: 'MEMBER', state: 'MERGED' },
          ],
        }),
      },
    });

    await ingest(client);

    expect(await storedAlpha()).toMatchObject({
      firstTimePrsTotal: 2,
      firstTimePrsMerged: 1,
    });
  });

  it('stores the last commit date of the default branch', async () => {
    const lastCommitAt = new Date('2026-09-15T12:00:00Z');
    const client = fakeGitHub({ repos: [aRepo('alpha', { lastCommitAt })] });

    await ingest(client);

    expect((await storedAlpha()).lastCommitAt).toEqual(lastCommitAt);
  });
});

describe('closing issues', () => {
  const twoIssues = (complete: boolean) =>
    fakeGitHub({
      repos: [aRepo('alpha')],
      activity: {
        alpha: anActivity({ complete, openIssues: [anIssue('1')] }),
      },
    });

  async function seedStoredIssues() {
    await ingest(
      fakeGitHub({
        repos: [aRepo('alpha')],
        activity: {
          alpha: anActivity({ openIssues: [anIssue('1'), anIssue('2')] }),
        },
      }),
    );
  }

  it('marks a stored issue closed when a complete fetch no longer returns it', async () => {
    await seedStoredIssues();

    await ingest(twoIssues(true));

    const states = Object.fromEntries(
      (await db.issue.findMany()).map((issue) => [issue.number, issue.state]),
    );
    expect(states).toEqual({ 1: 'open', 2: 'closed' });
  });

  it('never marks anything closed after an incomplete fetch', async () => {
    await seedStoredIssues();

    await ingest(twoIssues(false));

    const states = (await db.issue.findMany()).map((issue) => issue.state);
    expect(states).toEqual(['open', 'open']);
  });
});

describe('rate limit', () => {
  const threeRepos = () => [aRepo('alpha'), aRepo('bravo'), aRepo('charlie')];

  it('stops cleanly once remaining drops below the floor', async () => {
    const client = fakeGitHub({
      repos: threeRepos(),
      remainingAfterFetch: { alpha: 150 },
    });

    const summary = await ingest(client);

    expect(client.fetchedRepoNames).toEqual(['alpha']);
    expect(summary).toMatchObject({
      reposIngested: 1,
      stoppedForRateLimit: true,
    });
    expect(shouldFail(summary, oneSliceConfig)).toBe(false);
  });

  it('resumes with the oldest-ingested repos on the next run', async () => {
    await ingest(
      fakeGitHub({ repos: threeRepos(), remainingAfterFetch: { alpha: 150 } }),
    );
    const nextRun = fakeGitHub({ repos: threeRepos() });

    await ingest(nextRun);

    expect(nextRun.fetchedRepoNames).toEqual(['bravo', 'charlie', 'alpha']);
  });

  it('stops during discovery when search drops below the floor', async () => {
    const client = fakeGitHub({ repos: threeRepos(), searchRemaining: 100 });

    const summary = await ingest(client);

    expect(client.fetchedRepoNames).toEqual([]);
    expect(summary.stoppedForRateLimit).toBe(true);
  });
});

describe('failures', () => {
  it('logs, counts and skips a repo that fails', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha'), aRepo('bravo')],
      activity: { alpha: new Error('boom') },
    });

    const summary = await ingest(client);

    expect(summary).toMatchObject({ reposIngested: 1, errors: 1 });
    expect(
      await db.repo.findUniqueOrThrow({ where: { id: 'repo-bravo' } }),
    ).toMatchObject({ active: true });
  });

  it('fails the run when more than 10% of attempted repos errored', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha'), aRepo('bravo')],
      activity: { alpha: new Error('boom') },
    });

    const summary = await ingest(client);

    expect(shouldFail(summary, oneSliceConfig)).toBe(true);
  });

  it('tolerates an error rate of 10% or less', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `repo${i}`);
    const client = fakeGitHub({
      repos: names.map((name) => aRepo(name)),
      activity: { repo0: new Error('boom') },
    });

    const summary = await ingest(client);

    expect(shouldFail(summary, oneSliceConfig)).toBe(false);
  });
});

describe('run summary', () => {
  it('stores the summary of the run', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha')],
      activity: {
        alpha: anActivity({ openIssues: [anIssue('1'), anIssue('2')] }),
      },
    });

    await ingest(client);

    expect(await db.ingestRun.findFirstOrThrow()).toMatchObject({
      startedAt: now,
      reposIngested: 1,
      issuesIngested: 2,
      errors: 0,
      stoppedForRateLimit: false,
    });
  });

  it('limits the run to --max-repos repos', async () => {
    const client = fakeGitHub({
      repos: [aRepo('alpha'), aRepo('bravo'), aRepo('charlie')],
    });

    await ingest(client, { maxRepos: 2 });

    expect(client.fetchedRepoNames).toHaveLength(2);
  });
});
