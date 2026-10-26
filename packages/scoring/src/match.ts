import { applyCurve, combine, type BreakdownEntry } from './breakdown.js';
import { defaultScoringConfig, type ScoringConfig } from './config.js';

export type MatchComponent = keyof ScoringConfig['match']['weights'];

export interface MatchInput {
  profile: {
    languageShare: Record<string, number>;
    topics: string[];
  };
  issue: {
    repoLanguage: string;
    repoTopics: string[];
    repoHealth: number | null;
    daysSinceActivity: number;
    claimed: boolean;
  };
}

export interface MatchResult {
  score: number | null;
  breakdown: BreakdownEntry<MatchComponent>[];
  emptyProfile: boolean;
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a.map((topic) => topic.toLowerCase()));
  const setB = new Set(b.map((topic) => topic.toLowerCase()));
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function matchScore(
  { profile, issue }: MatchInput,
  config: ScoringConfig = defaultScoringConfig,
): MatchResult {
  const { weights, freshnessDays } = config.match;
  const hasLanguages = Object.keys(profile.languageShare).length > 0;
  const hasTopics = profile.topics.length > 0;

  const { score, breakdown } = combine<MatchComponent>([
    {
      component: 'language',
      weight: weights.language,
      value: hasLanguages
        ? (profile.languageShare[issue.repoLanguage] ?? 0)
        : null,
    },
    { component: 'health', weight: weights.health, value: issue.repoHealth },
    {
      component: 'topics',
      weight: weights.topics,
      value: hasTopics ? 100 * jaccard(profile.topics, issue.repoTopics) : null,
    },
    {
      component: 'freshness',
      weight: weights.freshness,
      value: applyCurve(issue.daysSinceActivity, freshnessDays),
    },
    {
      component: 'unclaimed',
      weight: weights.unclaimed,
      value: issue.claimed ? 0 : 100,
    },
  ]);

  return { score, breakdown, emptyProfile: !hasLanguages && !hasTopics };
}
