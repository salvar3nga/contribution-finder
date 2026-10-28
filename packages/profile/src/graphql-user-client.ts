import {
  RateLimitedError,
  type ActivityRepo,
  type GitHubUserClient,
  type TokenSource,
} from './github-user-client.js';

const endpoint = 'https://api.github.com/graphql';
const pageSize = 100;

export interface GraphqlUserClientOptions {
  tokenSource: TokenSource;
  fetch?: typeof fetch;
}

interface RawRepository {
  id: string;
  primaryLanguage: { name: string } | null;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
}

interface RawOwnedRepository extends RawRepository {
  pushedAt: string | null;
}

interface RawError {
  type?: string;
  path?: string[];
  message: string;
}

interface RawResponse {
  data?: {
    rateLimit: { remaining: number; resetAt: string };
    user: { repositories: { nodes: (RawOwnedRepository | null)[] } } | null;
    search: { nodes: ({ repository?: RawRepository } | null)[] };
  } | null;
  errors?: RawError[];
}

const repositoryFields = `
  id
  primaryLanguage { name }
  repositoryTopics(first: 20) { nodes { topic { name } } }`;

const userActivityQuery = `
query($login: String!, $pullRequests: String!) {
  rateLimit { remaining resetAt }
  user(login: $login) {
    repositories(first: ${pageSize}, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        pushedAt
        ${repositoryFields}
      }
    }
  }
  search(query: $pullRequests, type: ISSUE, first: ${pageSize}) {
    nodes {
      ... on PullRequest {
        repository {
          ${repositoryFields}
        }
      }
    }
  }
}`;

function toActivityRepo(raw: RawRepository): ActivityRepo {
  return {
    id: raw.id,
    language: raw.primaryLanguage?.name ?? null,
    topics: raw.repositoryTopics.nodes.map((node) => node.topic.name),
  };
}

export function createGraphqlUserClient({
  tokenSource,
  fetch: fetchImpl = fetch,
}: GraphqlUserClientOptions): GitHubUserClient {
  return {
    async fetchRecentActivity(username, since) {
      const sinceDay = since.toISOString().slice(0, 10);
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await tokenSource.getToken()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: userActivityQuery,
          variables: {
            login: username,
            pullRequests: `author:${username} is:pr is:merged merged:>=${sinceDay}`,
          },
        }),
      });
      if (response.status === 403 || response.status === 429) {
        throw new RateLimitedError();
      }
      if (!response.ok) {
        throw new Error(`GitHub GraphQL responded ${response.status}`);
      }
      const body = (await response.json()) as RawResponse;
      const errors = body.errors ?? [];
      if (errors.some((error) => error.type === 'RATE_LIMITED')) {
        throw new RateLimitedError();
      }
      if (errors.some((error) => error.type === 'NOT_FOUND')) {
        return { status: 'not-found' };
      }
      if (errors.length > 0 || !body.data) {
        throw new Error(
          `GitHub GraphQL error: ${errors.map((e) => e.message).join('; ')}`,
        );
      }
      const { data } = body;
      if (data.user === null) return { status: 'not-found' };
      return {
        status: 'found',
        ownedRepos: data.user.repositories.nodes
          .filter(
            (raw): raw is RawOwnedRepository =>
              raw !== null &&
              raw.pushedAt !== null &&
              new Date(raw.pushedAt) >= since,
          )
          .map(toActivityRepo),
        mergedPullRequestRepos: data.search.nodes.flatMap((node) =>
          node?.repository ? [toActivityRepo(node.repository)] : [],
        ),
        rateLimit: {
          remaining: data.rateLimit.remaining,
          resetAt: new Date(data.rateLimit.resetAt),
        },
      };
    },
  };
}
