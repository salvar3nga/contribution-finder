import type { PrismaClient } from '@cf/db';

export const seededNow = new Date('2026-10-28T12:00:00Z');
const dayMs = 24 * 60 * 60 * 1000;

export function daysAgo(days: number): Date {
  return new Date(seededNow.getTime() - days * dayMs);
}

interface RepoSeed {
  name: string;
  owner?: string;
  language?: string | null;
  stars?: number;
  topics?: string[];
  lastCommitAt?: Date | null;
  medianFirstResponseHours?: number | null;
  active?: boolean;
}

interface IssueSeed {
  number?: number;
  title?: string;
  claimed?: boolean;
  state?: 'open' | 'closed';
  lastActivityAt?: Date;
}

export async function seedRepo(
  db: PrismaClient,
  repo: RepoSeed,
  issues: IssueSeed[] = [{}],
): Promise<void> {
  const owner = repo.owner ?? 'acme';
  const id = `repo-${owner}-${repo.name}`;
  await db.repo.create({
    data: {
      id,
      owner,
      name: repo.name,
      language: repo.language === undefined ? 'TypeScript' : repo.language,
      stars: repo.stars ?? 1000,
      topics: repo.topics ?? [],
      lastCommitAt: repo.lastCommitAt === undefined ? daysAgo(3) : repo.lastCommitAt,
      medianFirstResponseHours:
        repo.medianFirstResponseHours === undefined
          ? 12
          : repo.medianFirstResponseHours,
      active: repo.active ?? true,
      issues: {
        create: issues.map((issue, index) => {
          const number = issue.number ?? index + 1;
          return {
            id: `${id}#${number}`,
            number,
            title: issue.title ?? `${repo.name} issue ${number}`,
            url: `https://github.com/${owner}/${repo.name}/issues/${number}`,
            labels: ['good first issue'],
            claimed: issue.claimed ?? false,
            state: issue.state ?? 'open',
            lastActivityAt: issue.lastActivityAt ?? daysAgo(10),
          };
        }),
      },
    },
  });
}
