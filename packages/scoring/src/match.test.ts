import { describe, expect, it } from "vitest";
import { defaultScoringConfig } from "./config.js";
import { matchScore, type MatchInput } from "./match.js";

const base: MatchInput = {
  profile: { languageShare: { TypeScript: 100 }, topics: ["react", "cli"] },
  issue: {
    repoLanguage: "TypeScript",
    repoTopics: ["react", "cli"],
    repoHealth: 100,
    daysSinceActivity: 30,
    claimed: false,
  },
};

const entry = (r: ReturnType<typeof matchScore>, component: string) =>
  r.breakdown.find((b) => b.component === component)!;

describe("matchScore", () => {
  it("scores 100 for a perfect match", () => {
    const r = matchScore(base);
    expect(r.score).toBeCloseTo(100);
    expect(r.emptyProfile).toBe(false);
  });

  it("uses the profile's language share as the language value", () => {
    const r = matchScore({
      ...base,
      profile: { ...base.profile, languageShare: { TypeScript: 40, Go: 60 } },
    });
    expect(entry(r, "language").value).toBe(40);
  });

  it("scores 0 for a language the profile never used, but still returns a score", () => {
    const r = matchScore({ ...base, issue: { ...base.issue, repoLanguage: "Rust" } });
    expect(entry(r, "language").value).toBe(0);
    expect(r.score).toBeCloseTo(65);
  });

  it("computes topic overlap as scaled Jaccard similarity", () => {
    const r = matchScore({
      ...base,
      profile: { ...base.profile, topics: ["react", "cli", "api"] },
      issue: { ...base.issue, repoTopics: ["react", "docs"] },
    });
    expect(entry(r, "topics").value).toBe(25);
  });

  it("scores 0 topic overlap when the repo has no topics but the profile does", () => {
    const r = matchScore({ ...base, issue: { ...base.issue, repoTopics: [] } });
    expect(entry(r, "topics").value).toBe(0);
  });

  it("marks topics as no data when the profile has no topics", () => {
    const r = matchScore({ ...base, profile: { ...base.profile, topics: [] } });
    expect(entry(r, "topics")).toEqual({
      component: "topics",
      value: null,
      weight: 0,
      contribution: null,
    });
    expect(r.score).toBeCloseTo(100);
  });

  it.each([
    [0, 100],
    [30, 100],
    [197.5, 50],
    [365, 0],
    [1000, 0],
  ])("freshness of %d days gives value %d", (days, value) => {
    const r = matchScore({ ...base, issue: { ...base.issue, daysSinceActivity: days } });
    expect(entry(r, "freshness").value).toBe(value);
  });

  it("ranks a Claimed issue lower without hiding it", () => {
    const open = matchScore(base);
    const claimed = matchScore({ ...base, issue: { ...base.issue, claimed: true } });
    expect(entry(claimed, "unclaimed").value).toBe(0);
    expect(claimed.score).toBeCloseTo(90);
    expect(claimed.score!).toBeLessThan(open.score!);
  });

  it("includes the repo's Health score and treats a null Health as no data", () => {
    const withHealth = matchScore({ ...base, issue: { ...base.issue, repoHealth: 40 } });
    expect(entry(withHealth, "health").value).toBe(40);
    const noHealth = matchScore({ ...base, issue: { ...base.issue, repoHealth: null } });
    expect(entry(noHealth, "health").weight).toBe(0);
    expect(entry(noHealth, "language").weight).toBeCloseTo(0.35 / 0.7);
  });

  it("has breakdown contributions that sum to the score and weights that sum to 1", () => {
    const r = matchScore({
      profile: { languageShare: { TypeScript: 70, Go: 30 }, topics: ["a", "b"] },
      issue: {
        repoLanguage: "Go",
        repoTopics: ["b", "c"],
        repoHealth: 62,
        daysSinceActivity: 100,
        claimed: true,
      },
    });
    expect(r.breakdown.reduce((s, b) => s + (b.contribution ?? 0), 0)).toBeCloseTo(r.score!);
    expect(r.breakdown.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1);
  });

  it("is deterministic", () => {
    expect(matchScore(base)).toEqual(matchScore(base));
  });

  describe("empty profile", () => {
    const empty = { languageShare: {}, topics: [] };

    it("drops language and topics and flags the result", () => {
      const r = matchScore({ ...base, profile: empty });
      expect(r.emptyProfile).toBe(true);
      expect(entry(r, "language").value).toBeNull();
      expect(entry(r, "topics").value).toBeNull();
      expect(r.breakdown.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1);
    });

    it("ranks by health, freshness and unclaimed only", () => {
      const r = matchScore({
        profile: empty,
        issue: { ...base.issue, repoHealth: 80, daysSinceActivity: 30, claimed: true },
      });
      expect(r.score).toBeCloseTo(68);
    });
  });

  describe("config", () => {
    it("re-normalizes weights that do not sum to 1", () => {
      const r = matchScore(
        { ...base, issue: { ...base.issue, repoLanguage: "Rust" } },
        {
          ...defaultScoringConfig,
          match: {
            ...defaultScoringConfig.match,
            weights: { language: 1, health: 1, topics: 0, freshness: 0, unclaimed: 0 },
          },
        },
      );
      expect(r.score).toBe(50);
    });

    it("changes results when the freshness thresholds change", () => {
      const r = matchScore(
        { ...base, issue: { ...base.issue, daysSinceActivity: 100 } },
        {
          ...defaultScoringConfig,
          match: { ...defaultScoringConfig.match, freshnessDays: { full: 30, zero: 100 } },
        },
      );
      expect(entry(r, "freshness").value).toBe(0);
    });
  });
});
