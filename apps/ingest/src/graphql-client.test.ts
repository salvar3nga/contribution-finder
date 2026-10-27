import { describe, expect, it } from 'vitest';
import { createGraphqlGitHubClient } from './graphql-client.js';
import searchRepos from './test-support/fixtures/search-repos.json' with { type: 'json' };
import repoIssues from './test-support/fixtures/repo-issues.json' with { type: 'json' };
import recentItems from './test-support/fixtures/recent-items.json' with { type: 'json' };
import recentPullRequests from './test-support/fixtures/recent-pull-requests.json' with { type: 'json' };

function recordedFetch(): typeof fetch {
  return async (_url, init) => {
    const { query } = JSON.parse(String(init?.body)) as { query: string };
    const body = query.includes('type: REPOSITORY')
      ? searchRepos
      : query.includes('closedByPullRequestsReferences')
        ? repoIssues
        : query.includes('authorAssociation')
          ? recentPullRequests
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
      { language: 'TypeScript', minStars: 500, maxStars: null },
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
      {
        createdAt: new Date('2026-10-11T00:00:00Z'),
        firstResponseAt: new Date('2026-10-11T02:00:00Z'),
      },
      { createdAt: new Date('2026-10-12T00:00:00Z'), firstResponseAt: null },
    ]);
    expect(value.recentPullRequests).toEqual([
      { authorAssociation: 'FIRST_TIME_CONTRIBUTOR', state: 'MERGED' },
      { authorAssociation: 'MEMBER', state: 'OPEN' },
    ]);
    expect(rateLimit.remaining).toBe(4978);
  });
});
