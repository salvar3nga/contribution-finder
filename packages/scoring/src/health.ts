import { combine, curveOrNull, type BreakdownEntry } from './breakdown.js';
import { defaultScoringConfig, type ScoringConfig } from './config.js';

export type HealthSignal = keyof ScoringConfig['health']['weights'];

interface FirstTimePrs {
  total: number;
  merged: number;
}

export interface HealthInput {
  medianFirstResponseHours: number | null;
  firstTimePrs: FirstTimePrs | null;
  daysSinceLastCommit: number | null;
}

export interface HealthResult {
  score: number | null;
  breakdown: BreakdownEntry<HealthSignal>[];
}

function mergeRate({ total, merged }: FirstTimePrs): number {
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
  const { score, breakdown, weightedComponents } = combine<HealthSignal>([
    {
      component: 'responseTime',
      weight: weights.responseTime,
      value: curveOrNull(input.medianFirstResponseHours, responseHours),
    },
    {
      component: 'firstTimeMergeRate',
      weight: weights.firstTimeMergeRate,
      value:
        firstTimePrs &&
        firstTimePrs.total > 0 &&
        firstTimePrs.total >= minFirstTimePrs
          ? mergeRate(firstTimePrs)
          : null,
    },
    {
      component: 'recentCommits',
      weight: weights.recentCommits,
      value: curveOrNull(input.daysSinceLastCommit, commitDays),
    },
  ]);
  if (weightedComponents < minSignalsWithData) {
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
