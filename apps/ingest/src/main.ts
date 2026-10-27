import { parseArgs } from 'node:util';
import { createDb } from '@cf/db';
import { defaultIngestConfig } from './config.js';
import { createGraphqlGitHubClient } from './graphql-client.js';
import { runIngest, shouldFail } from './pipeline.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function parseMaxRepos(): number | undefined {
  const { values } = parseArgs({
    options: { 'max-repos': { type: 'string' } },
  });
  const raw = values['max-repos'];
  if (raw === undefined) return undefined;
  const maxRepos = Number(raw);
  if (!Number.isInteger(maxRepos) || maxRepos < 1) {
    throw new Error('--max-repos must be a positive integer');
  }
  return maxRepos;
}

async function main(): Promise<number> {
  const maxRepos = parseMaxRepos();
  const db = createDb(requiredEnv('DATABASE_URL'));
  try {
    const client = createGraphqlGitHubClient({
      token: requiredEnv('GITHUB_TOKEN'),
      rateLimitFloor: defaultIngestConfig.rateLimitFloor,
      eligibleLabels: defaultIngestConfig.eligibleLabels,
      maxRecentItems: defaultIngestConfig.maxRecentItems,
    });
    const summary = await runIngest({
      client,
      db,
      now: new Date(),
      maxRepos,
      log: console.log,
    });
    return shouldFail(summary, defaultIngestConfig) ? 1 : 0;
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (exitCode) => process.exit(exitCode),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
