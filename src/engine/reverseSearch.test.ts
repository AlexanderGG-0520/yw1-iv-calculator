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
  b2Mode: "direct",
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
});
