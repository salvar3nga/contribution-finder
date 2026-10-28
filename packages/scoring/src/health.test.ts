import { describe, expect, it } from 'vitest';
import { defaultScoringConfig } from './config.js';
import { healthScore, type HealthInput } from './health.js';
import { breakdownEntry } from './test-support.js';

const { responseHours, commitDays } = defaultScoringConfig.health;

const full: HealthInput = {
  medianFirstResponseHours: responseHours.full,
  daysSinceLastCommit: commitDays.full,
};

describe('healthScore', () => {
  it('scores 100 when every signal is at its best threshold', () => {
    expect(healthScore(full).score).toBe(100);
  });

  it('scores 0 when every signal is at its worst', () => {
    const r = healthScore({
      medianFirstResponseHours: responseHours.zero,
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
    expect(breakdownEntry(r, 'responseTime').value).toBe(value);
  });

  it.each([
    [0, 100],
    [commitDays.full, 100],
    [(commitDays.full + commitDays.zero) / 2, 50],
    [commitDays.zero, 0],
    [commitDays.zero * 4, 0],
  ])('%d days since last commit gives signal value %i', (days, value) => {
    const r = healthScore({ ...full, daysSinceLastCommit: days });
    expect(breakdownEntry(r, 'recentCommits').value).toBe(value);
  });

  it('reports contributions that sum to the score, with default weights', () => {
    const r = healthScore({
      medianFirstResponseHours: 180,
      daysSinceLastCommit: 48.5,
    });
    expect(r.score).toBeCloseTo(0.6 * 50 + 0.4 * 50);
    const sum = r.breakdown.reduce((s, b) => s + (b.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(r.score!);
  });

  describe('no data', () => {
    it('treats null inputs as no data', () => {
      const r = healthScore({
        medianFirstResponseHours: null,
        daysSinceLastCommit: null,
      });
      expect(breakdownEntry(r, 'responseTime').value).toBeNull();
      expect(breakdownEntry(r, 'recentCommits').value).toBeNull();
    });

    it('returns a null score when fewer than two signals have data', () => {
      const r = healthScore({
        medianFirstResponseHours: null,
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
          component: 'recentCommits',
          value: 100,
          weight: 0,
          contribution: null,
        },
      ]);
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
            weights: { responseTime: 2, recentCommits: 2 },
          },
        },
      );
      expect(breakdownEntry(r, 'responseTime').weight).toBe(0.5);
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
      expect(breakdownEntry(r, 'recentCommits').value).toBe(0);
    });

    it.each([
      [30, 100],
      [31, 0],
    ])('treats equal thresholds as a step: %i days gives %i', (days, value) => {
      const r = healthScore(
        { ...full, daysSinceLastCommit: days },
        {
          ...defaultScoringConfig,
          health: {
            ...defaultScoringConfig.health,
            commitDays: { full: 30, zero: 30 },
          },
        },
      );
      expect(breakdownEntry(r, 'recentCommits').value).toBe(value);
    });

    it('does not count a zero-weight signal toward the required signals', () => {
      const r = healthScore(full, {
        ...defaultScoringConfig,
        health: {
          ...defaultScoringConfig.health,
          weights: { responseTime: 1, recentCommits: 0 },
        },
      });
      expect(r.score).toBeNull();
    });

    it('changes the number of signals required for a score', () => {
      const r = healthScore(
        { ...full, medianFirstResponseHours: null },
        {
          ...defaultScoringConfig,
          health: { ...defaultScoringConfig.health, minSignalsWithData: 1 },
        },
      );
      expect(r.score).toBe(100);
    });
  });
});
