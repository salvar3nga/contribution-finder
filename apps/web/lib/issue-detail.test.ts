import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@cf/db';
import { findIssueDetail } from './issue-detail';
import { createCleanTestDb } from './test-support/database';
import { daysAgo, seedRepo, seededNow } from './test-support/seed';

const profile = { languageShare: { TypeScript: 100 }, topics: ['cli'] };

let db: PrismaClient;

beforeEach(async () => {
  db = await createCleanTestDb();
});

describe('Issue detail', () => {
  it('returns the Issue with both Score breakdowns and the Repo facts', async () => {
    await seedRepo(
      db,
      {
        name: 'widgets',
        stars: 4200,
        topics: ['cli', 'ui'],
        lastCommitAt: daysAgo(3),
      },
      [{ number: 7, title: 'Fix the thing' }],
    );

    const detail = await findIssueDetail(
      db,
      profile,
      { owner: 'acme', repo: 'widgets', number: 7 },
      seededNow,
    );

    expect(detail).toMatchObject({
      issue: {
        title: 'Fix the thing',
        url: 'https://github.com/acme/widgets/issues/7',
      },
      repo: {
        language: 'TypeScript',
        stars: 4200,
        topics: ['cli', 'ui'],
        lastCommitAt: daysAgo(3),
        medianFirstResponseHours: 12,
      },
    });
    expect(detail!.match.breakdown.map((entry) => entry.component)).toEqual([
      'language',
      'health',
      'topics',
      'freshness',
      'unclaimed',
    ]);
    expect(detail!.health.breakdown.map((entry) => entry.component)).toEqual([
      'responseTime',
      'recentCommits',
    ]);
  });

  it('marks breakdown entries without data instead of scoring them zero', async () => {
    await seedRepo(db, { name: 'unknown', medianFirstResponseHours: null }, [
      { number: 1 },
    ]);

    const detail = await findIssueDetail(
      db,
      profile,
      { owner: 'acme', repo: 'unknown', number: 1 },
      seededNow,
    );

    expect(detail!.health.score).toBeNull();
    expect(
      detail!.health.breakdown.find(
        (entry) => entry.component === 'responseTime',
      ),
    ).toMatchObject({ value: null, contribution: null });
    expect(
      detail!.match.breakdown.find((entry) => entry.component === 'health'),
    ).toMatchObject({ value: null });
  });

  it('returns null for an Issue we do not have', async () => {
    await seedRepo(db, { name: 'widgets' }, [{ number: 1 }]);

    expect(
      await findIssueDetail(
        db,
        profile,
        { owner: 'acme', repo: 'widgets', number: 99 },
        seededNow,
      ),
    ).toBeNull();
  });
});
