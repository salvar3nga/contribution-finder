import { describe, expect, it } from 'vitest';
import { createGraphqlUserClient } from './graphql-user-client';
import { RateLimitedError } from './github-user-client';
import userActivity from './test-support/fixtures/user-activity.json' with { type: 'json' };

const since = new Date('2025-10-28T12:00:00Z');

function clientResponding(response: Response) {
  const requests: { variables: Record<string, string> }[] = [];
  const client = createGraphqlUserClient({
    tokenSource: { getToken: async () => 'test-token' },
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return response.clone();
    },
  });
  return { client, requests };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('GraphQL GitHub user adapter', () => {
  it('maps a recorded user activity response in one request', async () => {
    const { client, requests } = clientResponding(jsonResponse(userActivity));

    const activity = await client.fetchRecentActivity('Sergio', since);

    expect(requests).toHaveLength(1);
    expect(requests[0]!.variables).toMatchObject({ login: 'Sergio' });
    expect(requests[0]!.variables.pullRequests).toContain('author:Sergio');
    expect(requests[0]!.variables.pullRequests).toContain(
      'merged:>=2025-10-28',
    );
    expect(activity).toEqual({
      status: 'found',
      ownedRepos: [
        { id: 'R_owned_recent', language: 'TypeScript', topics: ['cli'] },
        { id: 'R_owned_no_language', language: null, topics: [] },
      ],
      mergedPullRequestRepos: [
        { id: 'R_upstream', language: 'Rust', topics: ['compiler', 'cli'] },
      ],
      rateLimit: {
        remaining: 4990,
        resetAt: new Date('2026-10-28T13:00:00Z'),
      },
    });
  });

  it('reports a missing user or an organisation as not found', async () => {
    const { client } = clientResponding(
      jsonResponse({
        data: null,
        errors: [
          {
            type: 'NOT_FOUND',
            path: ['user'],
            message: "Could not resolve to a User with the login of 'acme'.",
          },
        ],
      }),
    );

    expect(await client.fetchRecentActivity('acme', since)).toEqual({
      status: 'not-found',
    });
  });

  it('reports an exhausted rate limit as rate-limited', async () => {
    const { client } = clientResponding(
      jsonResponse({
        errors: [{ type: 'RATE_LIMITED', message: 'slow down' }],
      }),
    );

    await expect(client.fetchRecentActivity('sergio', since)).rejects.toThrow(
      RateLimitedError,
    );
  });

  it('reports HTTP 403 and 429 as rate-limited', async () => {
    for (const status of [403, 429]) {
      const { client } = clientResponding(jsonResponse({}, status));
      await expect(client.fetchRecentActivity('sergio', since)).rejects.toThrow(
        RateLimitedError,
      );
    }
  });

  it('surfaces other failures as generic errors', async () => {
    const { client } = clientResponding(jsonResponse({}, 500));

    await expect(client.fetchRecentActivity('sergio', since)).rejects.toThrow(
      'GitHub GraphQL responded 500',
    );
  });
});
