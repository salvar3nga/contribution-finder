export interface StarBand {
  minStars: number;
  maxStars: number | null;
}

export interface IngestConfig {
  languages: string[];
  starBands: StarBand[];
  eligibleLabels: string[];
  rateLimitFloor: number;
  activityWindowDays: number;
  maxRecentItems: number;
  minItemsForResponseTime: number;
  firstTimeAssociations: string[];
  maxErrorRate: number;
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
  rateLimitFloor: 200,
  activityWindowDays: 90,
  maxRecentItems: 50,
  minItemsForResponseTime: 5,
  firstTimeAssociations: ['FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER'],
  maxErrorRate: 0.1,
};
