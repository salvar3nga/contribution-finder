import { describe, expect, it } from 'vitest';
import { defaultScoringConfig } from './config.js';
import { healthScore, type HealthInput } from './health.js';

const { responseHours, commitDays, minFirstTimePrs } =
  defaultScoringConfig.health;

const full: HealthInput = {
  medianFirstResponseHours: responseHours.full,
  firstTimePrs: { total: 10, merged: 10 },
  daysSinceLastCommit: commitDays.full,
};

const entry = (r: ReturnType<typeof healthScore>, component: string) =>
  r.breakdown.find((b) => b.component === component)!;

describe('healthScore', () => {
  it('scores 100 when every signal is at its best threshold', () => {
    expect(healthScore(full).score).toBe(100);
  });

  it('scores 0 when every signal is at its worst', () => {
    const r = healthScore({
      medianFirstResponseHours: responseHours.zero,
      firstTimePrs: { total: 10, merged: 0 },
      daysSinceLastCommit: commitDays.zero,
    });
    expect(r.score).toBe(0);
  });

  it.each([
    [0, 100],
    [responseHours.full, 100],
    [(responseHours.full + responseHours.zero) / 2, 50],
    [responseHours.zero, 0],
    [responseHours.zero * 3, 0],
  ])('response time of %i h gives signal value %i', (hours, value) => {
    const r = healthScore({ ...full, medianFirstResponseHours: hours });
    expect(entry(r, 'responseTime').value).toBe(value);
  });

  it.each([
    [0, 100],
    [commitDays.full, 100],
    [(commitDays.full + commitDays.zero) / 2, 50],
    [commitDays.zero, 0],
    [commitDays.zero * 4, 0],
  ])('%d days since last commit gives signal value %i', (days, value) => {
    const r = healthScore({ ...full, daysSinceLastCommit: days });
    expect(entry(r, 'recentCommits').value).toBe(value);
  });

  it('uses the merged share of first-time PRs as the merge-rate value', () => {
    const r = healthScore({ ...full, firstTimePrs: { total: 4, merged: 1 } });
    expect(entry(r, 'firstTimeMergeRate').value).toBe(25);
  });

  it.each([
    [0, 0],
    [10, 100],
  ])(
    '%i of 10 first-time PRs merged gives merge-rate value %i',
    (merged, value) => {
      const r = healthScore({ ...full, firstTimePrs: { total: 10, merged } });
      expect(entry(r, 'firstTimeMergeRate').value).toBe(value);
    },
  );

  it('reports contributions that sum to the score, with default weights', () => {
    const r = healthScore({
      medianFirstResponseHours: 180,
      firstTimePrs: { total: 10, merged: 5 },
      daysSinceLastCommit: 7,
    });
    expect(r.score).toBeCloseTo(0.4 * 50 + 0.4 * 50 + 0.2 * 100);
    const sum = r.breakdown.reduce((s, b) => s + (b.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(r.score!);
  });

  describe('no data', () => {
    it('drops first-time merge rate below the minimum PR count and re-normalizes', () => {
      const r = healthScore({
        medianFirstResponseHours: 24,
        firstTimePrs: {
          total: minFirstTimePrs - 1,
          merged: minFirstTimePrs - 1,
        },
        daysSinceLastCommit: commitDays.zero,
      });
      expect(entry(r, 'firstTimeMergeRate')).toEqual({
        component: 'firstTimeMergeRate',
        value: null,
        weight: 0,
        contribution: null,
      });
      expect(entry(r, 'responseTime').weight).toBeCloseTo(2 / 3);
      expect(entry(r, 'recentCommits').weight).toBeCloseTo(1 / 3);
      expect(r.score).toBeCloseTo(100 * (2 / 3));
    });

    it('accepts exactly the minimum number of first-time PRs', () => {
      const r = healthScore({
        ...full,
        firstTimePrs: { total: minFirstTimePrs, merged: minFirstTimePrs },
      });
      expect(entry(r, 'firstTimeMergeRate').value).toBe(100);
    });

    it('treats null inputs as no data', () => {
      const r = healthScore({
        medianFirstResponseHours: null,
        firstTimePrs: null,
        daysSinceLastCommit: 7,
      });
      expect(entry(r, 'responseTime').value).toBeNull();
      expect(entry(r, 'firstTimeMergeRate').value).toBeNull();
    });

    it('returns a null score when fewer than two signals have data', () => {
      const r = healthScore({
        medianFirstResponseHours: null,
        firstTimePrs: null,
        daysSinceLastCommit: 7,
      });
      expect(r.score).toBeNull();
      expect(r.breakdown).toEqual([
        {
          component: 'responseTime',
          value: null,
          weight: 0,
          contribution: null,
        },
        {
          component: 'firstTimeMergeRate',
          value: null,
          weight: 0,
          contribution: null,
        },
        {
          component: 'recentCommits',
          value: null,
          weight: 0,
          contribution: null,
        },
      ]);
    });

    it('scores with exactly two signals', () => {
      const r = healthScore({ ...full, medianFirstResponseHours: null });
      expect(r.score).toBeCloseTo(100);
    });
  });

  describe('config', () => {
    it('re-normalizes weights that do not sum to 1', () => {
      const r = healthScore(
        { ...full, medianFirstResponseHours: responseHours.zero },
        {
          ...defaultScoringConfig,
          health: {
            ...defaultScoringConfig.health,
            weights: {
              responseTime: 2,
              firstTimeMergeRate: 1,
              recentCommits: 1,
            },
          },
        },
      );
      expect(entry(r, 'responseTime').weight).toBe(0.5);
      expect(r.score).toBe(50);
    });

    it('changes results when thresholds change', () => {
      const r = healthScore(
        { ...full, daysSinceLastCommit: 30 },
        {
          ...defaultScoringConfig,
          health: {
            ...defaultScoringConfig.health,
            commitDays: { full: 7, zero: 30 },
          },
        },
      );
      expect(entry(r, 'recentCommits').value).toBe(0);
    });

    it('changes the minimum first-time PR count', () => {
      const r = healthScore(
        { ...full, firstTimePrs: { total: 3, merged: 3 } },
        {
          ...defaultScoringConfig,
          health: { ...defaultScoringConfig.health, minFirstTimePrs: 5 },
        },
      );
      expect(entry(r, 'firstTimeMergeRate').value).toBeNull();
    });
  });
});
