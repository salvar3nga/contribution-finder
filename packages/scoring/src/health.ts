import { combine, curveOrNull, type BreakdownEntry } from './breakdown.js';
import { defaultScoringConfig, type ScoringConfig } from './config.js';

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

function mergeRate({
  total,
  merged,
}: {
  total: number;
  merged: number;
}): number {
  return (100 * merged) / total;
}

export function healthScore(
  input: HealthInput,
  config: ScoringConfig = defaultScoringConfig,
): HealthResult {
  const {
    weights,
    responseHours,
    commitDays,
    minFirstTimePrs,
    minSignalsWithData,
  } = config.health;
  const { firstTimePrs } = input;
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
        firstTimePrs && firstTimePrs.total >= minFirstTimePrs
          ? mergeRate(firstTimePrs)
          : null,
    },
    {
      component: 'recentCommits',
      weight: weights.recentCommits,
      value: curveOrNull(input.daysSinceLastCommit, commitDays),
    },
  ]);
  if (componentsWithData < minSignalsWithData) {
    return {
      score: null,
      breakdown: breakdown.map((entry) => ({
        ...entry,
        weight: 0,
        contribution: null,
      })),
    };
  }
  return { score, breakdown };
}
