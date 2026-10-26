export interface Curve {
  full: number;
  zero: number;
}

export interface ScoringConfig {
  health: {
    weights: {
      responseTime: number;
      firstTimeMergeRate: number;
      recentCommits: number;
    };
    responseHours: Curve;
    commitDays: Curve;
    minFirstTimePrs: number;
  };
  match: {
    weights: {
      language: number;
      health: number;
      topics: number;
      freshness: number;
      unclaimed: number;
    };
    freshnessDays: Curve;
  };
}

export const defaultScoringConfig: ScoringConfig = {
  health: {
    weights: { responseTime: 0.4, firstTimeMergeRate: 0.4, recentCommits: 0.2 },
    responseHours: { full: 24, zero: 14 * 24 },
    commitDays: { full: 7, zero: 90 },
    minFirstTimePrs: 3,
  },
  match: {
    weights: {
      language: 0.35,
      health: 0.3,
      topics: 0.15,
      freshness: 0.1,
      unclaimed: 0.1,
    },
    freshnessDays: { full: 30, zero: 365 },
  },
};
