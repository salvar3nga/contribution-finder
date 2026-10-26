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

function lowercased(topics: string[]): Set<string> {
  return new Set(topics.map((topic) => topic.toLowerCase()));
}

function topicOverlap(profileTopics: string[], repoTopics: string[]): number {
  const profileSet = lowercased(profileTopics);
  const repoSet = lowercased(repoTopics);
  const shared = [...profileSet].filter((topic) => repoSet.has(topic)).length;
  const combined = new Set([...profileSet, ...repoSet]).size;
  return combined === 0 ? 0 : shared / combined;
}

function languageShare(
  shareByLanguage: Record<string, number>,
  language: string,
): number {
  const wanted = language.toLowerCase();
  const match = Object.entries(shareByLanguage).find(
    ([name]) => name.toLowerCase() === wanted,
  );
  return match?.[1] ?? 0;
}

export function matchScore(
  { profile, issue }: MatchInput,
  config: ScoringConfig = defaultScoringConfig,
): MatchResult {
  const { weights, freshnessDays } = config.match;
  const hasLanguages = Object.keys(profile.languageShare).length > 0;
  const hasTopics = hasLanguages && profile.topics.length > 0;

  const { score, breakdown } = combine<MatchComponent>([
    {
      component: 'language',
      weight: weights.language,
      value: hasLanguages
        ? languageShare(profile.languageShare, issue.repoLanguage)
        : null,
    },
    { component: 'health', weight: weights.health, value: issue.repoHealth },
    {
      component: 'topics',
      weight: weights.topics,
      value: hasTopics
        ? 100 * topicOverlap(profile.topics, issue.repoTopics)
        : null,
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

  return { score, breakdown, emptyProfile: !hasLanguages };
}
