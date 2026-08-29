import { describe, expect, it } from "vitest";
import { reverseSearch } from "./reverseSearch";
import type { SearchInput, StatCalculationEngine, StatCalculationInput } from "./types";

const fixtureEngine: StatCalculationEngine = {
  id: "fixture",
  label: "Fixture",
  formulaStatus: "fixture",
  formulaStatusKind: "provisional",
  calculate(input: StatCalculationInput) {
    return input.ivA + input.ivB1 + input.ivB2;
  },
};

const input: SearchInput = {
  speciesId: "jibanyan",
  level: 10,
  observed: {
    hp: 2,
    strength: 2,
    spirit: 2,
    defense: 2,
    speed: 2,
  },
  personalityMode: "none",
  evolutionCount: 0,
  scorePreset: "physical_attacker",
  maxResults: 50,
};

describe("reverse search architecture", () => {
  it("combines stat candidates only when IV_B_1 totals 10", () => {
    const response = reverseSearch(input, fixtureEngine);

    expect(response.results.length).toBeGreaterThan(0);
    for (const result of response.results) {
      const b1Total = Object.values(result.ivB1).reduce((sum, value) => sum + value, 0);
      expect(b1Total).toBe(10);
    }
  });

  it("builds per-stat candidates before combining", () => {
    const response = reverseSearch(input, fixtureEngine);

    expect(response.summary.perStatCandidateCounts).toEqual({
      hp: 3,
      strength: 3,
      spirit: 3,
      defense: 3,
      speed: 3,
    });
  });

  it("uses the cumulative B_2 range for multiple evolutions", () => {
    const response = reverseSearch(
      {
        ...input,
        observed: {
          hp: 4,
          strength: 4,
          spirit: 4,
          defense: 4,
          speed: 4,
        },
        evolutionCount: 2,
      },
      fixtureEngine,
    );

    expect(response.summary.perStatCandidateCounts.hp).toBeGreaterThan(0);
    for (const result of response.results) {
      for (const value of Object.values(result.ivB2)) {
        expect(value).toBeGreaterThanOrEqual(2);
        expect(value).toBeLessThanOrEqual(6);
      }
    }
  });

  it("uses custom score weights when sorting reverse-search results", () => {
    const flexibleInput: SearchInput = {
      ...input,
      observed: {
        hp: 10,
        strength: 10,
        spirit: 10,
        defense: 10,
        speed: 10,
      },
      scorePreset: "custom",
      maxResults: 5,
    };

    const strengthFirst = reverseSearch(
      {
        ...flexibleInput,
        customScoreWeights: { hp: 0, strength: 5, spirit: 0, defense: 0, speed: 1 },
      },
      fixtureEngine,
    ).results[0];
    const speedFirst = reverseSearch(
      {
        ...flexibleInput,
        customScoreWeights: { hp: 0, strength: 1, spirit: 0, defense: 0, speed: 5 },
      },
      fixtureEngine,
    ).results[0];

    expect(strengthFirst.ivB1.strength).toBeGreaterThan(strengthFirst.ivB1.speed);
    expect(speedFirst.ivB1.speed).toBeGreaterThan(speedFirst.ivB1.strength);
  });

  it("summarizes ideal achievement across every valid candidate, not only retained top results", () => {
    const response = reverseSearch(
      {
        ...input,
        observed: {
          hp: 10,
          strength: 10,
          spirit: 10,
          defense: 10,
          speed: 10,
        },
        maxResults: 5,
      },
      fixtureEngine,
    );

    expect(response.results).toHaveLength(5);
    expect(response.summary.validCandidateCount).toBe(1001);
    expect(response.summary.idealAchievement).toBeDefined();
    expect(response.summary.idealAchievement!.complete).toBe(true);
    expect(response.summary.idealAchievement!.minPercent).toBeLessThanOrEqual(response.summary.idealAchievement!.medianPercent);
    expect(response.summary.idealAchievement!.medianPercent).toBeLessThanOrEqual(response.summary.idealAchievement!.maxPercent);
  });

  it("omits ideal achievement when evolution count is unknown", () => {
    const response = reverseSearch({ ...input, evolutionCount: "unknown" }, fixtureEngine);

    expect(response.summary.idealAchievement).toBeUndefined();
  });
});
