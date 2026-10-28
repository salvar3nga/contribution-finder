import { execFileSync } from 'node:child_process';
import { createDb } from '@cf/db';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://cf:cf@localhost:5432/contribution_finder_test';

async function seedSmokeData(): Promise<void> {
  execFileSync('pnpm', ['--filter', '@cf/db', 'migrate'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'ignore',
  });
  const db = createDb(testDatabaseUrl);
  await db.$executeRaw`TRUNCATE "Issue", "Repo" CASCADE`;
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);
  await db.repo.create({
    data: {
      id: 'smoke-widgets',
      owner: 'acme',
      name: 'widgets',
      language: 'TypeScript',
      stars: 4200,
      topics: ['cli'],
      lastCommitAt: daysAgo(2),
      medianFirstResponseHours: 10,
      active: true,
      issues: {
        create: {
          id: 'smoke-widgets#7',
          number: 7,
          title: 'Fix the widget alignment',
          url: 'https://github.com/acme/widgets/issues/7',
          labels: ['good first issue'],
          claimed: false,
          state: 'open',
          lastActivityAt: daysAgo(4),
        },
      },
    },
  });
  await db.repo.create({
    data: {
      id: 'smoke-gopher',
      owner: 'acme',
      name: 'gopher',
      language: 'Go',
      stars: 900,
      topics: [],
      lastCommitAt: null,
      medianFirstResponseHours: null,
      active: true,
      issues: {
        create: {
          id: 'smoke-gopher#3',
          number: 3,
          title: 'Document the config file',
          url: 'https://github.com/acme/gopher/issues/3',
          labels: ['help wanted'],
          claimed: true,
          state: 'open',
          lastActivityAt: daysAgo(30),
        },
      },
    },
  });
  await db.$disconnect();
}

await seedSmokeData();
