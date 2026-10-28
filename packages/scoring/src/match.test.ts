import { describe, expect, it } from 'vitest';
import { defaultScoringConfig } from './config';
import { matchScore, type MatchInput } from './match';
import { breakdownEntry } from './test-support';

const { freshnessDays } = defaultScoringConfig.match;

const base: MatchInput = {
  profile: { languageShare: { TypeScript: 100 }, topics: ['react', 'cli'] },
  issue: {
    repoLanguage: 'TypeScript',
    repoTopics: ['react', 'cli'],
    repoHealth: 100,
    daysSinceActivity: freshnessDays.full,
    claimed: false,
  },
};

describe('matchScore', () => {
  it('scores 100 for a perfect match', () => {
    const r = matchScore(base);
    expect(r.score).toBeCloseTo(100);
    expect(r.emptyProfile).toBe(false);
  });

  it("uses the profile's language share as the language value", () => {
    const r = matchScore({
      ...base,
      profile: { ...base.profile, languageShare: { TypeScript: 40, Go: 60 } },
    });
    expect(breakdownEntry(r, 'language').value).toBe(40);
  });

  it('scores 0 for a language the profile never used, but still returns a score', () => {
    const r = matchScore({
      ...base,
      issue: { ...base.issue, repoLanguage: 'Rust' },
    });
    expect(breakdownEntry(r, 'language').value).toBe(0);
    expect(r.score).toBeCloseTo(65);
  });

  it('computes topic overlap as scaled Jaccard similarity', () => {
    const r = matchScore({
      ...base,
      profile: { ...base.profile, topics: ['react', 'cli', 'api'] },
      issue: { ...base.issue, repoTopics: ['react', 'docs'] },
    });
    expect(breakdownEntry(r, 'topics').value).toBe(25);
  });

  it('scores 0 topic overlap when the repo has no topics but the profile does', () => {
    const r = matchScore({ ...base, issue: { ...base.issue, repoTopics: [] } });
    expect(breakdownEntry(r, 'topics').value).toBe(0);
  });

  it('marks topics as no data when the profile has no topics', () => {
    const r = matchScore({ ...base, profile: { ...base.profile, topics: [] } });
    expect(breakdownEntry(r, 'topics')).toEqual({
      component: 'topics',
      value: null,
      weight: 0,
      contribution: null,
    });
    expect(r.score).toBeCloseTo(100);
  });

  it.each([
    [0, 100],
    [freshnessDays.full, 100],
    [(freshnessDays.full + freshnessDays.zero) / 2, 50],
    [freshnessDays.zero, 0],
    [freshnessDays.zero * 3, 0],
  ])('freshness of %d days gives value %d', (days, value) => {
    const r = matchScore({
      ...base,
      issue: { ...base.issue, daysSinceActivity: days },
    });
    expect(breakdownEntry(r, 'freshness').value).toBe(value);
  });

  it('ranks a Claimed issue lower without hiding it', () => {
    const open = matchScore(base);
    const claimed = matchScore({
      ...base,
      issue: { ...base.issue, claimed: true },
    });
    expect(breakdownEntry(claimed, 'unclaimed').value).toBe(0);
    expect(claimed.score).toBeCloseTo(90);
    expect(claimed.score!).toBeLessThan(open.score!);
  });

  it("includes the repo's Health score and treats a null Health as no data", () => {
    const withHealth = matchScore({
      ...base,
      issue: { ...base.issue, repoHealth: 40 },
    });
    expect(breakdownEntry(withHealth, 'health').value).toBe(40);
    const noHealth = matchScore({
      ...base,
      issue: { ...base.issue, repoHealth: null },
    });
    expect(breakdownEntry(noHealth, 'health').weight).toBe(0);
    expect(breakdownEntry(noHealth, 'language').weight).toBeCloseTo(0.35 / 0.7);
  });

  it('has breakdown contributions that sum to the score and weights that sum to 1', () => {
    const r = matchScore({
      profile: {
        languageShare: { TypeScript: 70, Go: 30 },
        topics: ['a', 'b'],
      },
      issue: {
        repoLanguage: 'Go',
        repoTopics: ['b', 'c'],
        repoHealth: 62,
        daysSinceActivity: 100,
        claimed: true,
      },
    });
    expect(
      r.breakdown.reduce((s, b) => s + (b.contribution ?? 0), 0),
    ).toBeCloseTo(r.score!);
    expect(r.breakdown.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1);
  });

  it('is deterministic', () => {
    expect(matchScore(base)).toEqual(matchScore(base));
  });

  it.each([
    [120, 100],
    [-5, 0],
  ])('clamps a repo health of %i to %i', (repoHealth, value) => {
    const r = matchScore({ ...base, issue: { ...base.issue, repoHealth } });
    expect(breakdownEntry(r, 'health').value).toBe(value);
  });

  it.each([
    [150, 100],
    [-10, 0],
  ])('clamps a language share of %i to %i', (share, value) => {
    const r = matchScore({
      ...base,
      profile: { ...base.profile, languageShare: { TypeScript: share } },
    });
    expect(breakdownEntry(r, 'language').value).toBe(value);
  });

  it('matches the repo language case-insensitively', () => {
    const r = matchScore({
      ...base,
      profile: { ...base.profile, languageShare: { TypeScript: 40, Go: 60 } },
      issue: { ...base.issue, repoLanguage: 'typescript' },
    });
    expect(breakdownEntry(r, 'language').value).toBe(40);
  });

  it('sums language shares whose names differ only by case', () => {
    const r = matchScore({
      ...base,
      profile: {
        ...base.profile,
        languageShare: { TypeScript: 30, typescript: 20, Go: 50 },
      },
    });
    expect(breakdownEntry(r, 'language').value).toBe(50);
  });

  it('matches topics case-insensitively', () => {
    const r = matchScore({
      ...base,
      issue: { ...base.issue, repoTopics: ['React', 'CLI'] },
    });
    expect(breakdownEntry(r, 'topics').value).toBe(100);
  });

  it('keeps a zero-weight component in the breakdown with its value', () => {
    const r = matchScore(base, {
      ...defaultScoringConfig,
      match: {
        ...defaultScoringConfig.match,
        weights: {
          language: 1,
          health: 0,
          topics: 0,
          freshness: 0,
          unclaimed: 0,
        },
      },
    });
    expect(breakdownEntry(r, 'health')).toEqual({
      component: 'health',
      value: 100,
      weight: 0,
      contribution: 0,
    });
  });

  describe('empty profile', () => {
    it('is not flagged when the profile has languages but no topics', () => {
      const r = matchScore({
        ...base,
        profile: { languageShare: { TypeScript: 100 }, topics: [] },
      });
      expect(r.emptyProfile).toBe(false);
      expect(breakdownEntry(r, 'language').value).toBe(100);
      expect(breakdownEntry(r, 'topics').value).toBeNull();
    });

    it('is flagged, with topics also dropped, when the profile has topics but no languages', () => {
      const r = matchScore({
        ...base,
        profile: { languageShare: {}, topics: ['react'] },
      });
      expect(r.emptyProfile).toBe(true);
      expect(breakdownEntry(r, 'topics').value).toBeNull();
    });

    const empty = { languageShare: {}, topics: [] };

    it('drops language and topics and flags the result', () => {
      const r = matchScore({ ...base, profile: empty });
      expect(r.emptyProfile).toBe(true);
      expect(breakdownEntry(r, 'language').value).toBeNull();
      expect(breakdownEntry(r, 'topics').value).toBeNull();
      expect(r.breakdown.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1);
    });

    it('ranks by freshness and unclaimed only when health is also missing', () => {
      const r = matchScore({
        profile: empty,
        issue: {
          ...base.issue,
          repoHealth: null,
          daysSinceActivity: freshnessDays.full,
          claimed: false,
        },
      });
      expect(r.score).toBeCloseTo(100);
      expect(breakdownEntry(r, 'health').value).toBeNull();
    });

    it('ranks by health, freshness and unclaimed only', () => {
      const r = matchScore({
        profile: empty,
        issue: {
          ...base.issue,
          repoHealth: 80,
          daysSinceActivity: 30,
          claimed: true,
        },
      });
      expect(r.score).toBeCloseTo(68);
    });
  });

  describe('config', () => {
    it('re-normalizes weights that do not sum to 1', () => {
      const r = matchScore(
        { ...base, issue: { ...base.issue, repoLanguage: 'Rust' } },
        {
          ...defaultScoringConfig,
          match: {
            ...defaultScoringConfig.match,
            weights: {
              language: 1,
              health: 1,
              topics: 0,
              freshness: 0,
              unclaimed: 0,
            },
          },
        },
      );
      expect(r.score).toBe(50);
    });

    it('returns a null score when every weight is zero', () => {
      const r = matchScore(base, {
        ...defaultScoringConfig,
        match: {
          ...defaultScoringConfig.match,
          weights: {
            language: 0,
            health: 0,
            topics: 0,
            freshness: 0,
            unclaimed: 0,
          },
        },
      });
      expect(r.score).toBeNull();
    });

    it('changes results when the freshness thresholds change', () => {
      const r = matchScore(
        { ...base, issue: { ...base.issue, daysSinceActivity: 100 } },
        {
          ...defaultScoringConfig,
          match: {
            ...defaultScoringConfig.match,
            freshnessDays: { full: 30, zero: 100 },
          },
        },
      );
      expect(breakdownEntry(r, 'freshness').value).toBe(0);
    });
  });
});
