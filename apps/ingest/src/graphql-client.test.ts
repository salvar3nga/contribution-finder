import { describe, expect, it } from 'vitest';
import { createGraphqlGitHubClient } from './graphql-client.js';
import searchRepos from './test-support/fixtures/search-repos.json' with { type: 'json' };
import repoIssues from './test-support/fixtures/repo-issues.json' with { type: 'json' };
import recentPullRequestItems from './test-support/fixtures/recent-pull-request-items.json' with { type: 'json' };
import recentItems from './test-support/fixtures/recent-items.json' with { type: 'json' };

function recordedFetch(): typeof fetch {
  return async (_url, init) => {
    const { query, variables } = JSON.parse(String(init?.body)) as {
      query: string;
      variables: { query: string };
    };
    const body = query.includes('type: REPOSITORY')
      ? searchRepos
      : query.includes('closedByPullRequestsReferences')
        ? repoIssues
        : variables.query.includes('is:pr')
          ? recentPullRequestItems
          : recentItems;
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

const client = createGraphqlGitHubClient({
  token: 'test-token',
  rateLimitFloor: 200,
  eligibleLabels: ['good first issue', 'help wanted'],
  fetch: recordedFetch(),
});

describe('GraphQL GitHub adapter', () => {
  it('maps a recorded repository search response', async () => {
    const { value, rateLimit } = await client.searchRepos(
      {
        language: 'TypeScript',
        minStars: 500,
        maxStars: null,
        issueQualifier: 'good-first-issues',
      },
      null,
    );

    expect(value.nextCursor).toBe('Y3Vyc29yOjEwMA==');
    expect(value.repos).toEqual([
      {
        id: 'R_kgDOAAAA1',
        owner: 'acme',
        name: 'widgets',
        language: 'TypeScript',
        stars: 1523,
        topics: ['ui', 'react'],
        lastCommitAt: new Date('2026-10-20T08:30:00Z'),
        isFork: false,
        isArchived: false,
      },
      {
        id: 'R_kgDOAAAA2',
        owner: 'acme',
        name: 'empty-shell',
        language: null,
        stars: 800,
        topics: [],
        lastCommitAt: null,
        isFork: false,
        isArchived: false,
      },
    ]);
    expect(rateLimit.remaining).toBe(4987);
  });

  it('maps recorded issue, response and pull request data for a repo', async () => {
    const { value, rateLimit } = await client.fetchRepoActivity(
      { owner: 'acme', name: 'widgets' },
      new Date('2026-07-29T00:00:00Z'),
    );

    expect(value.complete).toBe(true);
    expect(value.openIssues).toEqual([
      {
        id: 'I_kwDOAAAA1',
        number: 12,
        title: 'Docs: fix broken link',
        url: 'https://github.com/acme/widgets/issues/12',
        labels: ['Good First Issue', 'docs'],
        assigneeCount: 1,
        openLinkedPrCount: 0,
        lastActivityAt: new Date('2026-10-18T10:00:00Z'),
      },
      {
        id: 'I_kwDOAAAA2',
        number: 15,
        title: 'Add dark mode',
        url: 'https://github.com/acme/widgets/issues/15',
        labels: ['help wanted'],
        assigneeCount: 0,
        openLinkedPrCount: 1,
        lastActivityAt: new Date('2026-10-22T10:00:00Z'),
      },
    ]);
    expect(value.recentItems).toEqual([
      {
        createdAt: new Date('2026-10-10T00:00:00Z'),
        firstResponseAt: new Date('2026-10-10T06:00:00Z'),
      },
      { createdAt: new Date('2026-10-12T00:00:00Z'), firstResponseAt: null },
      {
        createdAt: new Date('2026-10-11T00:00:00Z'),
        firstResponseAt: new Date('2026-10-11T02:00:00Z'),
      },
    ]);
    expect(rateLimit.remaining).toBe(4979);
  });

  it('retries a transient 5xx response before giving up', async () => {
    const responses = [502, 502, 200];
    const flakyClient = createGraphqlGitHubClient({
      token: 'test-token',
      rateLimitFloor: 200,
      eligibleLabels: ['good first issue'],
      retryDelayMs: 0,
      fetch: async () => {
        const status = responses.shift()!;
        return new Response(JSON.stringify(searchRepos), { status });
      },
    });

    const { value } = await flakyClient.searchRepos(
      {
        language: 'TypeScript',
        minStars: 500,
        maxStars: null,
        issueQualifier: 'good-first-issues',
      },
      null,
    );

    expect(value.repos).toHaveLength(2);
  });

  it('fails after exhausting retries on a persistent 5xx', async () => {
    const brokenClient = createGraphqlGitHubClient({
      token: 'test-token',
      rateLimitFloor: 200,
      eligibleLabels: ['good first issue'],
      retryDelayMs: 0,
      fetch: async () => new Response('', { status: 502 }),
    });

    await expect(
      brokenClient.searchRepos(
        {
          language: 'TypeScript',
          minStars: 500,
          maxStars: null,
          issueQualifier: 'good-first-issues',
        },
        null,
      ),
    ).rejects.toThrow('502');
  });

  it('qualifies every issue and PR search with is:issue or is:pr, which GitHub requires', async () => {
    const searchStrings: string[] = [];
    const recordingClient = createGraphqlGitHubClient({
      token: 'test-token',
      rateLimitFloor: 200,
      eligibleLabels: ['good first issue'],
      fetch: async (url, init) => {
        const { query, variables } = JSON.parse(String(init?.body)) as {
          query: string;
          variables: { query: string };
        };
        if (!query.includes('type: REPOSITORY')) {
          searchStrings.push(variables.query);
        }
        return recordedFetch()(url, init);
      },
    });

    await recordingClient.fetchRepoActivity(
      { owner: 'acme', name: 'widgets' },
      new Date('2026-07-29T00:00:00Z'),
    );

    expect(searchStrings.length).toBeGreaterThan(0);
    for (const searchString of searchStrings) {
      expect(searchString).toMatch(/is:(issue|pr)/);
    }
  });

  it('restricts repo search to repos with open issues for the qualifier', async () => {
    const searchStrings: string[] = [];
    const recordingClient = createGraphqlGitHubClient({
      token: 'test-token',
      rateLimitFloor: 200,
      eligibleLabels: ['good first issue'],
      fetch: async (url, init) => {
        const { variables } = JSON.parse(String(init?.body)) as {
          variables: { query: string };
        };
        searchStrings.push(variables.query);
        return recordedFetch()(url, init);
      },
    });

    await recordingClient.searchRepos(
      {
        language: 'Go',
        minStars: 500,
        maxStars: 699,
        issueQualifier: 'help-wanted-issues',
      },
      null,
    );

    expect(searchStrings[0]).toContain('help-wanted-issues:>0');
  });
});
