import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@cf/db';
import { loadActiveRepos, rankIssues, type ScoringProfile } from './ranking';
import { createCleanTestDb } from './test-support/database';
import { daysAgo, seedRepo, seededNow } from './test-support/seed';

const typescriptDeveloper: ScoringProfile = {
  languageShare: { TypeScript: 100 },
  topics: [],
};

let db: PrismaClient;

beforeEach(async () => {
  db = await createCleanTestDb();
});

async function rank(
  options: { language?: string | null; page?: number } = {},
  profile = typescriptDeveloper,
) {
  return rankIssues(await loadActiveRepos(db), profile, {
    language: options.language ?? null,
    page: options.page ?? 1,
    now: seededNow,
  });
}

describe('ranking Issues for a Profile', () => {
  it('orders Issues by Match score, best first', async () => {
    await seedRepo(db, { name: 'other-language', language: 'Go' }, [
      { title: 'wrong language' },
    ]);
    await seedRepo(db, { name: 'matching' }, [{ title: 'right language' }]);

    const { items } = await rank();

    expect(items.map((item) => item.issue.title)).toEqual([
      'right language',
      'wrong language',
    ]);
    expect(items[0]!.matchScore!).toBeGreaterThan(items[1]!.matchScore!);
  });

  it('considers only open Issues of active Repos', async () => {
    await seedRepo(db, { name: 'live' }, [
      { title: 'open' },
      { title: 'closed', state: 'closed' },
    ]);
    await seedRepo(db, { name: 'dormant', active: false }, [
      { title: 'in dormant repo' },
    ]);

    const { items, total } = await rank();

    expect(items.map((item) => item.issue.title)).toEqual(['open']);
    expect(total).toBe(1);
  });

  it('paginates at 50 per page', async () => {
    await seedRepo(
      db,
      { name: 'busy' },
      Array.from({ length: 120 }, (_, index) => ({
        lastActivityAt: daysAgo(index),
      })),
    );

    const first = await rank({ page: 1 });
    const third = await rank({ page: 3 });

    expect(first.items).toHaveLength(50);
    expect(third.items).toHaveLength(20);
    expect(first).toMatchObject({ total: 120, page: 1, pageCount: 3 });
    expect(third.page).toBe(3);
  });

  it('keeps the global order across pages', async () => {
    await seedRepo(
      db,
      { name: 'busy' },
      Array.from({ length: 60 }, (_, index) => ({
        number: index + 1,
        lastActivityAt: daysAgo(index * 5),
      })),
    );

    const first = await rank({ page: 1 });
    const second = await rank({ page: 2 });
    const scores = [...first.items, ...second.items].map(
      (item) => item.matchScore!,
    );

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('orders Issues with equal Match scores by most recent activity', async () => {
    await seedRepo(db, { name: 'tied' }, [
      { title: 'older', lastActivityAt: daysAgo(20) },
      { title: 'newest', lastActivityAt: daysAgo(2) },
      { title: 'newer', lastActivityAt: daysAgo(10) },
    ]);

    const { items } = await rank();

    expect(new Set(items.map((item) => item.matchScore)).size).toBe(1);
    expect(items.map((item) => item.issue.title)).toEqual([
      'newest',
      'newer',
      'older',
    ]);
  });

  it('orders Issues with equal score and activity by Issue id', async () => {
    const sameMoment = daysAgo(5);
    await seedRepo(db, { name: 'tied' }, [
      { number: 2, title: 'second', lastActivityAt: sameMoment },
      { number: 1, title: 'first', lastActivityAt: sameMoment },
    ]);

    const { items } = await rank();

    expect(items.map((item) => item.issue.title)).toEqual(['first', 'second']);
  });

  it('clamps an out-of-range page to the last page', async () => {
    await seedRepo(db, { name: 'small' }, [{}, {}]);

    const result = await rank({ page: 9 });

    expect(result).toMatchObject({ page: 1, pageCount: 1 });
    expect(result.items).toHaveLength(2);
  });

  it('filters by language and keeps the ordering', async () => {
    await seedRepo(db, { name: 'ts-stale' }, [
      { title: 'ts stale', lastActivityAt: daysAgo(300) },
    ]);
    await seedRepo(db, { name: 'go-repo', language: 'Go' }, [
      { title: 'go issue' },
    ]);
    await seedRepo(db, { name: 'ts-fresh' }, [
      { title: 'ts fresh', lastActivityAt: daysAgo(2) },
    ]);

    const result = await rank({ language: 'TypeScript' });

    expect(result.items.map((item) => item.issue.title)).toEqual([
      'ts fresh',
      'ts stale',
    ]);
    expect(result.total).toBe(2);
  });

  it('lists the languages available to filter on, regardless of the filter', async () => {
    await seedRepo(db, { name: 'a' });
    await seedRepo(db, { name: 'b', language: 'Go' });
    await seedRepo(db, { name: 'c', language: 'Go' });

    const result = await rank({ language: 'Go' });

    expect(result.languages).toEqual(['Go', 'TypeScript']);
  });

  it('shows Claimed Issues, ranked below an otherwise equal unclaimed one', async () => {
    await seedRepo(db, { name: 'same' }, [
      { title: 'claimed', claimed: true },
      { title: 'unclaimed', claimed: false },
    ]);

    const { items } = await rank();

    expect(items.map((item) => [item.issue.title, item.issue.claimed])).toEqual(
      [
        ['unclaimed', false],
        ['claimed', true],
      ],
    );
  });

  it('passes a null Health score through', async () => {
    await seedRepo(db, {
      name: 'unknown-health',
      lastCommitAt: null,
      medianFirstResponseHours: null,
    });

    const { items } = await rank();

    expect(items[0]!.repo.health).toBeNull();
  });

  it('flags an Empty Profile and still ranks healthy Issues first', async () => {
    await seedRepo(db, { name: 'quiet', lastCommitAt: daysAgo(400) }, [
      { title: 'unhealthy' },
    ]);
    await seedRepo(db, { name: 'lively' }, [{ title: 'healthy' }]);

    const result = await rank({}, { languageShare: {}, topics: [] });

    expect(result.emptyProfile).toBe(true);
    expect(result.items.map((item) => item.issue.title)).toEqual([
      'healthy',
      'unhealthy',
    ]);
  });

  it('names the components that contributed most to each Match score', async () => {
    await seedRepo(db, { name: 'fits', topics: ['cli'] }, [
      { title: 'fresh and open', lastActivityAt: daysAgo(1) },
    ]);
    await seedRepo(db, { name: 'poor-fit', language: 'Go' }, [
      {
        title: 'claimed elsewhere',
        claimed: true,
        lastActivityAt: daysAgo(400),
      },
    ]);

    const { items } = await rank(
      {},
      { languageShare: { TypeScript: 100 }, topics: ['cli'] },
    );
    const fits = items.find((item) => item.issue.title === 'fresh and open')!;
    const poorFit = items.find(
      (item) => item.issue.title === 'claimed elsewhere',
    )!;

    expect(fits.strengths).toEqual(['language', 'health', 'topics']);
    expect(poorFit.strengths).toEqual(['health']);
  });
});
