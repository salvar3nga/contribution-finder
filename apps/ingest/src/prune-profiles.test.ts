import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@cf/db';
import { pruneStaleProfiles } from './prune-profiles.js';
import { createCleanTestDb } from './test-support/database.js';

const now = new Date('2026-10-31T03:00:00Z');
const day = 24 * 60 * 60 * 1000;

let db: PrismaClient;

beforeEach(async () => {
  db = await createCleanTestDb();
  await db.profile.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

function aProfile(username: string, builtAt: Date) {
  return {
    username,
    outcome: 'profile' as const,
    languageShare: { Go: 100 },
    topics: [],
    builtAt,
  };
}

describe('pruneStaleProfiles', () => {
  it('deletes Profiles older than 7 days and keeps the rest', async () => {
    await db.profile.createMany({
      data: [
        aProfile('stale', new Date(now.getTime() - 8 * day)),
        aProfile('recent', new Date(now.getTime() - 6 * day)),
        aProfile('fresh', now),
      ],
    });
    const log = vi.fn();

    await pruneStaleProfiles(db, now, log);

    expect(log).toHaveBeenCalledWith('Pruned 1 stale profiles');
    const remaining = await db.profile.findMany({
      orderBy: { username: 'asc' },
    });
    expect(remaining.map((profile) => profile.username)).toEqual([
      'fresh',
      'recent',
    ]);
  });

  it('deletes nothing when every Profile is recent', async () => {
    await db.profile.createMany({ data: [aProfile('fresh', now)] });
    const log = vi.fn();

    await pruneStaleProfiles(db, now, log);

    expect(log).toHaveBeenCalledWith('Pruned 0 stale profiles');
    expect(await db.profile.count()).toBe(1);
  });

  it('logs a failure instead of throwing, so it cannot fail the ingest', async () => {
    const failingDb = {
      profile: {
        deleteMany: () => Promise.reject(new Error('connection lost')),
      },
    } as unknown as PrismaClient;
    const log = vi.fn();

    await expect(
      pruneStaleProfiles(failingDb, now, log),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      'Failed to prune stale profiles: Error: connection lost',
    );
  });
});
