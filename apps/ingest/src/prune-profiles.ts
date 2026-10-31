import type { PrismaClient } from '@cf/db';

const retentionMs = 7 * 24 * 60 * 60 * 1000;

export async function pruneStaleProfiles(
  db: PrismaClient,
  now: Date,
  log: (message: string) => void,
): Promise<void> {
  try {
    const { count } = await db.profile.deleteMany({
      where: { builtAt: { lt: new Date(now.getTime() - retentionMs) } },
    });
    log(`Pruned ${count} stale profiles`);
  } catch (error) {
    log(`Failed to prune stale profiles: ${String(error)}`);
  }
}
