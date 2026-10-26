import { combine, applyCurve, type BreakdownEntry } from "./breakdown.js";
import { defaultScoringConfig, type ScoringConfig } from "./config.js";

export interface HealthInput {
  medianFirstResponseHours: number | null;
  firstTimePrs: { total: number; merged: number } | null;
  daysSinceLastCommit: number | null;
}

export interface HealthResult {
  score: number | null;
  breakdown: BreakdownEntry[];
}

export function healthScore(
  input: HealthInput,
  config: ScoringConfig = defaultScoringConfig,
): HealthResult {
  const { weights, responseHours, commitDays, minFirstTimePrs, minSignals } = config.health;
  const prs = input.firstTimePrs;
  const { score, breakdown, withData } = combine([
    {
      component: "responseTime",
      weight: weights.responseTime,
      value:
        input.medianFirstResponseHours === null
          ? null
          : applyCurve(input.medianFirstResponseHours, responseHours),
    },
    {
      component: "firstTimeMergeRate",
      weight: weights.firstTimeMergeRate,
      value: prs && prs.total >= minFirstTimePrs ? (100 * prs.merged) / prs.total : null,
    },
    {
      component: "recentCommits",
      weight: weights.recentCommits,
      value:
        input.daysSinceLastCommit === null
          ? null
          : applyCurve(input.daysSinceLastCommit, commitDays),
    },
  ]);
  if (withData < minSignals) {
    return {
      score: null,
      breakdown: breakdown.map((b) => ({ ...b, weight: 0, contribution: null })),
    };
  }
  return { score, breakdown };
}
