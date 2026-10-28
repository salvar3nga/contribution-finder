import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@cf/db';
import { createProfileBuilder } from './build-profile';
import { RateLimitedError } from './github-user-client';
import { createCleanTestDb } from './test-support/database';
import {
  aRepo,
  fakeUserClient,
  foundActivity,
} from './test-support/fake-user-client';

const now = new Date('2026-10-28T12:00:00Z');
const hour = 60 * 60 * 1000;

let db: PrismaClient;

beforeEach(async () => {
  db = await createCleanTestDb();
});

function builderFor(
  client: ReturnType<typeof fakeUserClient>,
  clock: { now: Date } = { now },
) {
  return createProfileBuilder({ db, client, now: () => clock.now });
}

describe('building a Profile', () => {
  it('shares languages across counted repos, summing to 100', async () => {
    const client = fakeUserClient(() =>
      foundActivity(
        [aRepo('a', 'TypeScript', ['cli']), aRepo('b', 'TypeScript', ['ui'])],
        [aRepo('c', 'Go', ['cli']), aRepo('d', 'Rust')],
      ),
    );

    const outcome = await builderFor(client)('sergio');

    expect(outcome).toEqual({
      kind: 'profile',
      profile: {
        languageShare: { TypeScript: 50, Go: 25, Rust: 25 },
        topics: ['cli', 'ui'],
        emptyProfile: false,
      },
    });
  });

  it('counts a repo once when it is both owned and has a merged PR', async () => {
    const client = fakeUserClient(() =>
      foundActivity(
        [aRepo('a', 'TypeScript')],
        [aRepo('a', 'TypeScript'), aRepo('b', 'Go')],
      ),
    );

    const outcome = await builderFor(client)('sergio');

    expect(outcome).toMatchObject({
      profile: { languageShare: { TypeScript: 50, Go: 50 } },
    });
  });

  it('skips repos with no primary language', async () => {
    const client = fakeUserClient(() =>
      foundActivity([aRepo('a', 'Go'), aRepo('b', null, ['docs'])]),
    );

    const outcome = await builderFor(client)('sergio');

    expect(outcome).toMatchObject({
      profile: { languageShare: { Go: 100 }, topics: [] },
    });
  });

  it('asks for the last 12 months of activity', async () => {
    const client = fakeUserClient(() => foundActivity([aRepo('a', 'Go')]));

    await builderFor(client)('sergio');

    expect(client.calls[0]!.since).toEqual(new Date('2025-10-28T12:00:00Z'));
  });

  it('returns an Empty Profile when there is no activity', async () => {
    const client = fakeUserClient(() => foundActivity([]));

    const outcome = await builderFor(client)('sergio');

    expect(outcome).toEqual({
      kind: 'profile',
      profile: { languageShare: {}, topics: [], emptyProfile: true },
    });
  });
});

describe('outcomes', () => {
  it('returns not found for an unknown user or an organisation', async () => {
    const client = fakeUserClient(() => ({ status: 'not-found' }));

    expect(await builderFor(client)('ghost')).toEqual({ kind: 'not-found' });
  });

  it('returns rate-limited when GitHub says the limit is exhausted', async () => {
    const client = fakeUserClient(() => new RateLimitedError());

    expect(await builderFor(client)('sergio')).toEqual({
      kind: 'rate-limited',
    });
  });

  it('surfaces any other failure as an exception', async () => {
    const client = fakeUserClient(() => new Error('boom'));

    await expect(builderFor(client)('sergio')).rejects.toThrow('boom');
  });
});

describe('cache', () => {
  it('reuses a Profile within 24 hours without calling the client', async () => {
    const clock = { now };
    const client = fakeUserClient(() => foundActivity([aRepo('a', 'Go')]));
    const build = builderFor(client, clock);

    const first = await build('sergio');
    clock.now = new Date(now.getTime() + 23 * hour);
    const second = await build('sergio');

    expect(second).toEqual(first);
    expect(client.calls).toHaveLength(1);
  });

  it('rebuilds an expired Profile', async () => {
    const clock = { now };
    const client = fakeUserClient(() => foundActivity([aRepo('a', 'Go')]));
    const build = builderFor(client, clock);

    await build('sergio');
    clock.now = new Date(now.getTime() + 25 * hour);
    await build('sergio');

    expect(client.calls).toHaveLength(2);
  });

  it('caches an Empty Profile like any other', async () => {
    const client = fakeUserClient(() => foundActivity([]));
    const build = builderFor(client);

    await build('sergio');
    const second = await build('sergio');

    expect(second).toMatchObject({ profile: { emptyProfile: true } });
    expect(client.calls).toHaveLength(1);
  });

  it('caches not found for 1 hour', async () => {
    const clock = { now };
    const client = fakeUserClient(() => ({ status: 'not-found' }));
    const build = builderFor(client, clock);

    await build('ghost');
    clock.now = new Date(now.getTime() + 0.5 * hour);
    await build('ghost');
    expect(client.calls).toHaveLength(1);

    clock.now = new Date(now.getTime() + 1.5 * hour);
    await build('ghost');
    expect(client.calls).toHaveLength(2);
  });

  it('never caches rate-limited outcomes or errors', async () => {
    let failure: Error = new RateLimitedError();
    const client = fakeUserClient(() => failure);
    const build = builderFor(client);

    await build('sergio');
    failure = new Error('boom');
    await expect(build('sergio')).rejects.toThrow();

    expect(client.calls).toHaveLength(2);
    expect(await db.profile.count()).toBe(0);
  });

  it('shares one cache entry between usernames differing only in case', async () => {
    const client = fakeUserClient(() => foundActivity([aRepo('a', 'Go')]));
    const build = builderFor(client);

    await build('Sergio');
    await build('SERGIO');

    expect(client.calls).toHaveLength(1);
    expect(await db.profile.count()).toBe(1);
  });
});

describe('rate protection', () => {
  it('rate-limits the 801st uncached build in an hour but still serves cached usernames', async () => {
    const client = fakeUserClient(() => foundActivity([aRepo('a', 'Go')]));
    const build = builderFor(client);
    await db.profile.createMany({
      data: Array.from({ length: 800 }, (_, index) => ({
        username: `user${index}`,
        outcome: 'profile' as const,
        languageShare: { Go: 100 },
        topics: [],
        builtAt: new Date(now.getTime() - 10 * 60 * 1000),
      })),
    });

    expect(await build('newcomer')).toEqual({ kind: 'rate-limited' });
    expect(client.calls).toHaveLength(0);
    expect(await build('user7')).toMatchObject({ kind: 'profile' });
  });

  it('does not count builds older than an hour', async () => {
    const client = fakeUserClient(() => foundActivity([aRepo('a', 'Go')]));
    const build = builderFor(client);
    await db.profile.createMany({
      data: Array.from({ length: 800 }, (_, index) => ({
        username: `user${index}`,
        outcome: 'profile' as const,
        languageShare: { Go: 100 },
        topics: [],
        builtAt: new Date(now.getTime() - 2 * hour),
      })),
    });

    expect(await build('newcomer')).toMatchObject({ kind: 'profile' });
  });
});
