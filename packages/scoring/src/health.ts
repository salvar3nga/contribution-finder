import {
  combine,
  curveOrNull,
  noData,
  type BreakdownEntry,
} from './breakdown.js';
import { defaultScoringConfig, type ScoringConfig } from './config.js';

const MINIMUM_SIGNALS_WITH_DATA = 2;

export type HealthComponent = keyof ScoringConfig['health']['weights'];

export interface HealthInput {
  medianFirstResponseHours: number | null;
  firstTimePrs: { total: number; merged: number } | null;
  daysSinceLastCommit: number | null;
}

export interface HealthResult {
  score: number | null;
  breakdown: BreakdownEntry<HealthComponent>[];
}

export function healthScore(
  input: HealthInput,
  config: ScoringConfig = defaultScoringConfig,
): HealthResult {
  const { weights, responseHours, commitDays, minFirstTimePrs } = config.health;
  const prs = input.firstTimePrs;
  const { score, breakdown, componentsWithData } = combine<HealthComponent>([
    {
      component: 'responseTime',
      weight: weights.responseTime,
      value: curveOrNull(input.medianFirstResponseHours, responseHours),
    },
    {
      component: 'firstTimeMergeRate',
      weight: weights.firstTimeMergeRate,
      value:
        prs && prs.total >= minFirstTimePrs
          ? (100 * prs.merged) / prs.total
          : null,
    },
    {
      component: 'recentCommits',
      weight: weights.recentCommits,
      value: curveOrNull(input.daysSinceLastCommit, commitDays),
    },
  ]);
  if (componentsWithData < MINIMUM_SIGNALS_WITH_DATA) {
    return {
      score: null,
      breakdown: breakdown.map((b) => noData(b.component)),
    };
  }
  return { score, breakdown };
}
