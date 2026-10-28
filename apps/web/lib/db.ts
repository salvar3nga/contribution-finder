import { createDb, type PrismaClient } from '@cf/db';

const globalForDb = globalThis as unknown as { database?: PrismaClient };

export function getDb(): PrismaClient {
  globalForDb.database ??= createDb(process.env.DATABASE_URL ?? '');
  return globalForDb.database;
}
