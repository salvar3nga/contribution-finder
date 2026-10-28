import type {
  GitHubClient,
  RateLimit,
  RecentItem,
  RepoActivity,
  RepoIssue,
  SearchSlice,
} from './github-client.js';

const endpoint = 'https://api.github.com/graphql';
const searchPageSize = 100;
const repoSearchPageSize = 25;
const maxRequestAttempts = 4;
const defaultRetryDelayMs = 2000;
const recentItemsPageSize = 50;

export interface GraphqlClientOptions {
  token: string;
  rateLimitFloor: number;
  eligibleLabels: string[];
  maxRecentItems?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
}

interface Page<Node> {
  nodes: (Node | null)[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

interface RawRateLimit {
  remaining: number;
  resetAt: string;
}

interface Login {
  login: string;
}

interface RawAuthored {
  author: Login | null;
}

interface RawRepository {
  id: string;
  name: string;
  owner: Login;
  stargazerCount: number;
  isFork: boolean;
  isArchived: boolean;
  primaryLanguage: { name: string } | null;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  defaultBranchRef: { target: { committedDate?: string } | null } | null;
}

interface RawIssue {
  id: string;
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  labels: { nodes: { name: string }[] };
  assignees: { totalCount: number };
  closedByPullRequestsReferences: { totalCount: number } | null;
}

interface RawRecentItem extends RawAuthored {
  createdAt: string;
  comments: { nodes: (RawAuthored & { createdAt: string })[] };
  reviews?: { nodes: (RawAuthored & { createdAt: string })[] };
}

const rateLimitFragment = 'rateLimit { remaining resetAt }';
const pageInfoFragment = 'pageInfo { hasNextPage endCursor }';

const searchReposQuery = `
query($query: String!, $cursor: String) {
  ${rateLimitFragment}
  search(query: $query, type: REPOSITORY, first: ${repoSearchPageSize}, after: $cursor) {
    ${pageInfoFragment}
    nodes {
      ... on Repository {
        id
        name
        owner { login }
        stargazerCount
        isFork
        isArchived
        primaryLanguage { name }
        repositoryTopics(first: 20) { nodes { topic { name } } }
        defaultBranchRef { target { ... on Commit { committedDate } } }
      }
    }
  }
}`;

const issuesQuery = `
query($query: String!, $cursor: String) {
  ${rateLimitFragment}
  search(query: $query, type: ISSUE, first: ${searchPageSize}, after: $cursor) {
    ${pageInfoFragment}
    nodes {
      ... on Issue {
        id
        number
        title
        url
        updatedAt
        labels(first: 20) { nodes { name } }
        assignees { totalCount }
        closedByPullRequestsReferences(first: 1, includeClosedPrs: false) { totalCount }
      }
    }
  }
}`;

const recentItemsQuery = `
query($query: String!, $first: Int!) {
  ${rateLimitFragment}
  search(query: $query, type: ISSUE, first: $first) {
    nodes {
      ... on Issue {
        createdAt
        author { login }
        comments(first: 5) { nodes { createdAt author { login } } }
      }
      ... on PullRequest {
        createdAt
        author { login }
        comments(first: 5) { nodes { createdAt author { login } } }
        reviews(first: 5) { nodes { createdAt author { login } } }
      }
    }
  }
}`;

function searchQualifier(slice: SearchSlice): string {
  const stars =
    slice.maxStars === null
      ? `>=${slice.minStars}`
      : `${slice.minStars}..${slice.maxStars}`;
  return `language:"${slice.language}" stars:${stars} fork:false archived:false ${slice.issueQualifier}:>0 sort:stars-desc`;
}

function present<Node extends object>(nodes: (Node | null)[]): Node[] {
  return nodes.filter(
    (node): node is Node => node !== null && Object.keys(node).length > 0,
  );
}

function firstResponseAt(item: RawRecentItem): Date | null {
  const responses = [
    ...item.comments.nodes,
    ...(item.reviews?.nodes ?? []),
  ].filter(
    (response) =>
      response.author !== null && response.author.login !== item.author?.login,
  );
  const times = responses.map((response) =>
    new Date(response.createdAt).getTime(),
  );
  return times.length === 0 ? null : new Date(Math.min(...times));
}

export function createGraphqlGitHubClient(
  options: GraphqlClientOptions,
): GitHubClient {
  const {
    token,
    rateLimitFloor,
    eligibleLabels,
    maxRecentItems = recentItemsPageSize,
    retryDelayMs = defaultRetryDelayMs,
    fetch: fetchImpl = fetch,
  } = options;

  async function fetchWithRetry(body: string): Promise<Response> {
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
      });
      if (response.ok) return response;
      const retryable = response.status >= 500;
      if (!retryable || attempt >= maxRequestAttempts) {
        throw new Error(`GitHub GraphQL responded ${response.status}`);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * attempt),
      );
    }
  }

  async function request<Data extends { rateLimit: RawRateLimit }>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<{ data: Data; rateLimit: RateLimit }> {
    const response = await fetchWithRetry(JSON.stringify({ query, variables }));
    const body = (await response.json()) as {
      data?: Data;
      errors?: { message: string }[];
    };
    if (body.errors?.length || !body.data) {
      throw new Error(
        `GitHub GraphQL error: ${body.errors?.map((e) => e.message).join('; ')}`,
      );
    }
    return {
      data: body.data,
      rateLimit: {
        remaining: body.data.rateLimit.remaining,
        resetAt: new Date(body.data.rateLimit.resetAt),
      },
    };
  }

  async function collectPages<Node extends object>(
    query: string,
    searchString: string,
  ): Promise<{ nodes: Node[]; complete: boolean; rateLimit: RateLimit }> {
    const nodes: Node[] = [];
    let cursor: string | null = null;
    for (;;) {
      const response: {
        data: { rateLimit: RawRateLimit; search: Page<Node> };
        rateLimit: RateLimit;
      } = await request<{
        rateLimit: RawRateLimit;
        search: Page<Node>;
      }>(query, { query: searchString, cursor });
      const { data, rateLimit } = response;
      nodes.push(...present(data.search.nodes));
      if (!data.search.pageInfo.hasNextPage) {
        return { nodes, complete: true, rateLimit };
      }
      if (rateLimit.remaining < rateLimitFloor) {
        return { nodes, complete: false, rateLimit };
      }
      cursor = data.search.pageInfo.endCursor;
    }
  }

  async function fetchRecentItems(
    searchString: string,
    first: number,
  ): Promise<{ items: RawRecentItem[]; rateLimit: RateLimit }> {
    const { data, rateLimit } = await request<{
      rateLimit: RawRateLimit;
      search: { nodes: (RawRecentItem | null)[] };
    }>(recentItemsQuery, { query: searchString, first });
    return { items: present(data.search.nodes), rateLimit };
  }

  return {
    async searchRepos(slice, cursor) {
      const { data, rateLimit } = await request<{
        rateLimit: RawRateLimit;
        search: Page<RawRepository>;
      }>(searchReposQuery, { query: searchQualifier(slice), cursor });
      return {
        value: {
          repos: present(data.search.nodes).map((raw) => ({
            id: raw.id,
            owner: raw.owner.login,
            name: raw.name,
            language: raw.primaryLanguage?.name ?? null,
            stars: raw.stargazerCount,
            topics: raw.repositoryTopics.nodes.map((n) => n.topic.name),
            lastCommitAt: raw.defaultBranchRef?.target?.committedDate
              ? new Date(raw.defaultBranchRef.target.committedDate)
              : null,
            isFork: raw.isFork,
            isArchived: raw.isArchived,
          })),
          nextCursor: data.search.pageInfo.hasNextPage
            ? data.search.pageInfo.endCursor
            : null,
        },
        rateLimit,
      };
    },

    async fetchRepoActivity(repo, since) {
      const scope = `repo:${repo.owner}/${repo.name}`;
      const sinceDay = since.toISOString().slice(0, 10);
      const rawIssues = new Map<string, RawIssue>();
      let complete = true;

      for (const label of eligibleLabels) {
        const result = await collectPages<RawIssue>(
          issuesQuery,
          `${scope} is:issue is:open label:"${label}"`,
        );
        result.nodes.forEach((raw) => rawIssues.set(raw.id, raw));
        complete = complete && result.complete;
        if (!result.complete) break;
      }

      const issueSampleSize = Math.ceil(maxRecentItems / 2);
      const recentIssues = await fetchRecentItems(
        `${scope} is:issue created:>=${sinceDay} sort:created-desc`,
        issueSampleSize,
      );
      const recentPullRequests = await fetchRecentItems(
        `${scope} is:pr created:>=${sinceDay} sort:created-desc`,
        maxRecentItems - issueSampleSize,
      );
      const openIssues: RepoIssue[] = [...rawIssues.values()].map((raw) => ({
        id: raw.id,
        number: raw.number,
        title: raw.title,
        url: raw.url,
        labels: raw.labels.nodes.map((label) => label.name),
        assigneeCount: raw.assignees.totalCount,
        openLinkedPrCount: raw.closedByPullRequestsReferences?.totalCount ?? 0,
        lastActivityAt: new Date(raw.updatedAt),
      }));
      const recentItems: RecentItem[] = [
        ...recentIssues.items,
        ...recentPullRequests.items,
      ].map((raw) => ({
        createdAt: new Date(raw.createdAt),
        firstResponseAt: firstResponseAt(raw),
      }));
      const value: RepoActivity = {
        complete,
        openIssues,
        recentItems,
      };
      return { value, rateLimit: recentPullRequests.rateLimit };
    },
  };
}
