import { Prisma, type PrismaClient } from '@cf/db';
import {
  RateLimitedError,
  type ActivityRepo,
  type GitHubUserClient,
} from './github-user-client';

const hourMs = 60 * 60 * 1000;
const activityWindowMonths = 12;
const profileTtlMs = 24 * hourMs;
const notFoundTtlMs = hourMs;
const uncachedBuildsPerHour = 800;

export interface Profile {
  languageShare: Record<string, number>;
  topics: string[];
  emptyProfile: boolean;
}

export type ProfileOutcome =
  | { kind: 'profile'; profile: Profile }
  | { kind: 'not-found' }
  | { kind: 'rate-limited' };

export interface ProfileBuilderOptions {
  db: PrismaClient;
  client: GitHubUserClient;
  now?: () => Date;
}

function monthsBefore(date: Date, months: number): Date {
  const earlier = new Date(date);
  earlier.setUTCMonth(earlier.getUTCMonth() - months);
  return earlier;
}

function profileFrom(repos: ActivityRepo[]): Profile {
  const counted = new Map<string, ActivityRepo>();
  repos.forEach((repo) => counted.set(repo.id, repo));
  const withLanguage = [...counted.values()].filter(
    (repo) => repo.language !== null,
  );
  const languageCounts = new Map<string, number>();
  withLanguage.forEach((repo) => {
    const language = repo.language!;
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  });
  const languageShare = Object.fromEntries(
    [...languageCounts].map(([language, count]) => [
      language,
      (100 * count) / withLanguage.length,
    ]),
  );
  const topics = [
    ...new Set(withLanguage.flatMap((repo) => repo.topics)),
  ].sort();
  return { languageShare, topics, emptyProfile: withLanguage.length === 0 };
}

export function createProfileBuilder({
  db,
  client,
  now = () => new Date(),
}: ProfileBuilderOptions): (username: string) => Promise<ProfileOutcome> {
  async function cachedOutcome(
    key: string,
    at: Date,
  ): Promise<ProfileOutcome | null> {
    const row = await db.profile.findUnique({ where: { username: key } });
    if (row === null) return null;
    const age = at.getTime() - row.builtAt.getTime();
    if (row.outcome === 'not_found') {
      return age < notFoundTtlMs ? { kind: 'not-found' } : null;
    }
    if (age >= profileTtlMs) return null;
    return {
      kind: 'profile',
      profile: {
        languageShare: row.languageShare as Record<string, number>,
        topics: row.topics,
        emptyProfile: row.emptyProfile,
      },
    };
  }

  async function store(
    key: string,
    at: Date,
    outcome: ProfileOutcome,
  ): Promise<void> {
    const data =
      outcome.kind === 'profile'
        ? {
            outcome: 'profile' as const,
            languageShare: outcome.profile.languageShare,
            topics: outcome.profile.topics,
            emptyProfile: outcome.profile.emptyProfile,
            builtAt: at,
          }
        : {
            outcome: 'not_found' as const,
            languageShare: Prisma.DbNull,
            topics: [],
            emptyProfile: false,
            builtAt: at,
          };
    await db.profile.upsert({
      where: { username: key },
      create: { username: key, ...data },
      update: data,
    });
  }

  return async function buildProfile(username) {
    const key = username.toLowerCase();
    const at = now();

    const cached = await cachedOutcome(key, at);
    if (cached !== null) return cached;

    const recentBuilds = await db.profile.count({
      where: { builtAt: { gt: new Date(at.getTime() - hourMs) } },
    });
    if (recentBuilds >= uncachedBuildsPerHour) return { kind: 'rate-limited' };

    let outcome: ProfileOutcome;
    try {
      const activity = await client.fetchRecentActivity(
        key,
        monthsBefore(at, activityWindowMonths),
      );
      outcome =
        activity.status === 'not-found'
          ? { kind: 'not-found' }
          : {
              kind: 'profile',
              profile: profileFrom([
                ...activity.ownedRepos,
                ...activity.mergedPullRequestRepos,
              ]),
            };
    } catch (error) {
      if (error instanceof RateLimitedError) return { kind: 'rate-limited' };
      throw error;
    }
    await store(key, at, outcome);
    return outcome;
  };
}
