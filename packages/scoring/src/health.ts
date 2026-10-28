import { combine, curveOrNull, type BreakdownEntry } from './breakdown';
import { defaultScoringConfig, type ScoringConfig } from './config';

export type HealthSignal = keyof ScoringConfig['health']['weights'];

export interface HealthInput {
  medianFirstResponseHours: number | null;
  daysSinceLastCommit: number | null;
}

export interface HealthResult {
  score: number | null;
  breakdown: BreakdownEntry<HealthSignal>[];
}

export function healthScore(
  input: HealthInput,
  config: ScoringConfig = defaultScoringConfig,
): HealthResult {
  const { weights, responseHours, commitDays, minSignalsWithData } =
    config.health;
  const { score, breakdown, weightedComponents } = combine<HealthSignal>([
    {
      component: 'responseTime',
      weight: weights.responseTime,
      value: curveOrNull(input.medianFirstResponseHours, responseHours),
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
