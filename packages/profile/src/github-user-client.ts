export class RateLimitedError extends Error {
  constructor(message = 'GitHub rate limit exhausted') {
    super(message);
    this.name = 'RateLimitedError';
  }
}

export interface ActivityRepo {
  id: string;
  language: string | null;
  topics: string[];
}

export interface RateLimit {
  remaining: number;
  resetAt: Date;
}

export type UserActivity =
  | { status: 'not-found' }
  | {
      status: 'found';
      ownedRepos: ActivityRepo[];
      mergedPullRequestRepos: ActivityRepo[];
      rateLimit: RateLimit;
    };

export interface GitHubUserClient {
  fetchRecentActivity(username: string, since: Date): Promise<UserActivity>;
}

export interface TokenSource {
  getToken(): Promise<string>;
}
