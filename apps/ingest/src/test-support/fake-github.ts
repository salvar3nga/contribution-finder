import type {
  DiscoveredRepo,
  GitHubClient,
  RateLimit,
  RepoActivity,
  RepoIssue,
  SearchSlice,
} from '../github-client.js';

export const farFuture = new Date('2030-01-01T00:00:00Z');

export function aRepo(
  name: string,
  overrides: Partial<DiscoveredRepo> = {},
): DiscoveredRepo {
  return {
    id: `repo-${name}`,
    owner: 'acme',
    name,
    language: 'TypeScript',
    stars: 1200,
    topics: ['cli'],
    lastCommitAt: new Date('2026-10-20T00:00:00Z'),
    isFork: false,
    isArchived: false,
    ...overrides,
  };
}

export function anIssue(
  id: string,
  overrides: Partial<RepoIssue> = {},
): RepoIssue {
  return {
    id: `issue-${id}`,
    number: Number(id),
    title: `Issue ${id}`,
    url: `https://github.com/acme/issue/${id}`,
    labels: ['good first issue'],
    assigneeCount: 0,
    openLinkedPrCount: 0,
    lastActivityAt: new Date('2026-10-10T00:00:00Z'),
    ...overrides,
  };
}

export function anActivity(
  overrides: Partial<RepoActivity> = {},
): RepoActivity {
  return {
    complete: true,
    openIssues: [anIssue('1')],
    recentItems: [],
    ...overrides,
  };
}

interface FakeGitHubOptions {
  repos: DiscoveredRepo[];
  activity?: Record<string, RepoActivity | Error>;
  remainingAfterFetch?: Record<string, number>;
  searchRemaining?: number;
  searchPageSize?: number;
}

export interface FakeGitHub extends GitHubClient {
  fetchedRepoNames: string[];
  searchedSlices: SearchSlice[];
}

export function fakeGitHub({
  repos,
  activity = {},
  remainingAfterFetch = {},
  searchRemaining = 5000,
  searchPageSize = Number.POSITIVE_INFINITY,
}: FakeGitHubOptions): FakeGitHub {
  const rateLimitWith = (remaining: number): RateLimit => ({
    remaining,
    resetAt: farFuture,
  });
  const fake: FakeGitHub = {
    fetchedRepoNames: [],
    searchedSlices: [],
    async searchRepos(slice, cursor) {
      fake.searchedSlices.push(slice);
      const start = cursor === null ? 0 : Number(cursor);
      const firstSlice = fake.searchedSlices[0]!;
      const isFirstSlice =
        firstSlice.language === slice.language &&
        firstSlice.minStars === slice.minStars &&
        firstSlice.issueQualifier === slice.issueQualifier;
      const end = start + searchPageSize;
      return {
        value: {
          repos: isFirstSlice ? repos.slice(start, end) : [],
          nextCursor: isFirstSlice && end < repos.length ? String(end) : null,
        },
        rateLimit: rateLimitWith(searchRemaining),
      };
    },
    async fetchRepoActivity(repo) {
      fake.fetchedRepoNames.push(repo.name);
      const result = activity[repo.name] ?? anActivity();
      if (result instanceof Error) throw result;
      return {
        value: result,
        rateLimit: rateLimitWith(remainingAfterFetch[repo.name] ?? 5000),
      };
    },
  };
  return fake;
}
