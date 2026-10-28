import type {
  ActivityRepo,
  GitHubUserClient,
  UserActivity,
} from '../github-user-client.js';

export function aRepo(
  id: string,
  language: string | null,
  topics: string[] = [],
): ActivityRepo {
  return { id, language, topics };
}

export function foundActivity(
  ownedRepos: ActivityRepo[],
  mergedPullRequestRepos: ActivityRepo[] = [],
): UserActivity {
  return {
    status: 'found',
    ownedRepos,
    mergedPullRequestRepos,
    rateLimit: { remaining: 5000, resetAt: new Date('2030-01-01T00:00:00Z') },
  };
}

export interface FakeUserClient extends GitHubUserClient {
  calls: { username: string; since: Date }[];
}

export function fakeUserClient(
  respond: (username: string) => UserActivity | Error,
): FakeUserClient {
  const fake: FakeUserClient = {
    calls: [],
    async fetchRecentActivity(username, since) {
      fake.calls.push({ username, since });
      const result = respond(username);
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return fake;
}
