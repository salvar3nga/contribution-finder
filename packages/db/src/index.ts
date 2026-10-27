import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

export { PrismaClient, Prisma } from './generated/client.js';
export type { Repo, Issue, IngestRun } from './generated/client.js';
export { IssueState } from './generated/enums.js';

export function createDb(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
