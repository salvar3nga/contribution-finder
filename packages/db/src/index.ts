import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export { PrismaClient, Prisma } from './generated/client';
export type { Repo, Issue, IngestRun, Profile } from './generated/client';
export { IssueState } from './generated/enums';

export function createDb(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
