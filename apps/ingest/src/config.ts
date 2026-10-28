export interface StarBand {
  minStars: number;
  maxStars: number | null;
}

export interface IngestConfig {
  languages: string[];
  starBands: StarBand[];
  eligibleLabels: string[];
  discoveryIssueQualifiers: string[];
  rateLimitFloor: number;
  activityWindowDays: number;
  maxRecentItems: number;
  minItemsForResponseTime: number;
  maxErrorRate: number;
  concurrency: number;
  transactionTimeoutMs: number;
}

export const defaultIngestConfig: IngestConfig = {
  languages: [
    'TypeScript',
    'JavaScript',
    'Python',
    'Java',
    'Go',
    'Rust',
    'C#',
    'PHP',
  ],
  starBands: [
    { minStars: 500, maxStars: 699 },
    { minStars: 700, maxStars: 999 },
    { minStars: 1000, maxStars: 1999 },
    { minStars: 2000, maxStars: 4999 },
    { minStars: 5000, maxStars: null },
  ],
  eligibleLabels: ['good first issue', 'help wanted'],
  discoveryIssueQualifiers: ['good-first-issues', 'help-wanted-issues'],
  rateLimitFloor: 200,
  activityWindowDays: 90,
  maxRecentItems: 50,
  minItemsForResponseTime: 5,
  maxErrorRate: 0.1,
  concurrency: 5,
  transactionTimeoutMs: 60_000,
};
