import { createDb, type PrismaClient } from '@cf/db';

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://cf:cf@localhost:5432/contribution_finder_test';

export async function createCleanTestDb(): Promise<PrismaClient> {
  const db = createDb(testDatabaseUrl);
  await db.$executeRaw`TRUNCATE "Issue", "Repo" CASCADE`;
  return db;
}
