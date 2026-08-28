import { describe, expect, it } from "vitest";
import {
  BUILT_IN_SCORE_PROFILES,
  BALANCED_SCORE_PROFILE,
  idealScoreForContext,
  resolveScoreProfile,
  scoreResult,
} from "./scoring";
import type { ReverseResult, ScoreProfileId, StatBlock } from "./types";

const block = (hp: number, strength: number, spirit: number, defense: number, speed: number): StatBlock => ({
  hp,
  strength,
  spirit,
  defense,
  speed,
});

const result = (ivA: StatBlock): Omit<ReverseResult, "id" | "score" | "scoreProfile"> => ({
  ivA,
  ivB1: block(0, 0, 0, 0, 0),
  ivB2: block(0, 0, 0, 0, 0),
  calculated: block(0, 0, 0, 0, 0),
});

describe("score profiles", () => {
  it("defines every built-in practical evaluation profile", () => {
    const expected: Exclude<ScoreProfileId, "custom">[] = [
      "physical_attacker",
      "fast_physical",
      "bulky_physical",
      "magic_attacker",
      "fast_magic",
      "bulky_magic",
      "wall",
      "healer",
      "disruptor",
      "support",
      "balanced",
      "speed_focus",
    ];

    expect(BUILT_IN_SCORE_PROFILES.map((profile) => profile.id)).toEqual(expected);
    for (const profile of BUILT_IN_SCORE_PROFILES) {
      expect(profile.name).not.toBe("");
      expect(profile.description).not.toBe("");
      expect(Object.values(profile.weights).some((weight) => weight > 0)).toBe(true);
    }
  });

  it("lets custom weights affect score and therefore sorting", () => {
    const strengthCandidate = result(block(0, 10, 0, 0, 0));
    const speedCandidate = result(block(0, 0, 0, 0, 10));
    const strengthWeights = block(0, 5, 0, 0, 1);
    const speedWeights = block(0, 1, 0, 0, 5);

    expect(scoreResult(strengthCandidate, strengthWeights)).toBeGreaterThan(scoreResult(speedCandidate, strengthWeights));
    expect(scoreResult(speedCandidate, speedWeights)).toBeGreaterThan(scoreResult(strengthCandidate, speedWeights));
  });

  it("falls back to balanced scoring when custom weights are all zero", () => {
    const profile = resolveScoreProfile("custom", block(0, 0, 0, 0, 0));

    expect(profile).toBe(BALANCED_SCORE_PROFILE);
    expect(scoreResult(result(block(1, 1, 1, 1, 1)), profile)).toBe(10);
  });
});

describe("ideal achievement baseline", () => {
  it("calculates the theoretical best score from IV_A, B_1, B_2, evolution count, and role weights", () => {
    const ivAMax = block(0, 0, 0, 8, 0);
    const wall = resolveScoreProfile("wall");

    // IV_A: 8 * defense weight 4 = 32
    // B_1: all 10 on defense => 10 * 2 * 4 = 80
    // B_2 at two evolutions: max 6 on every stat => 6 * total weight 9 = 54
    expect(idealScoreForContext(ivAMax, 2, wall)).toBe(166);
  });

  it("does not invent an ideal rate when evolution count is unknown", () => {
    expect(idealScoreForContext(block(0, 0, 0, 8, 0), "unknown", resolveScoreProfile("wall"))).toBeNull();
  });
});
