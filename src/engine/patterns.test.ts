import { describe, expect, it } from "vitest";
import { generateB1Patterns, generateB2Patterns, isLazyPatternSource } from "./patterns";
import { STAT_KEYS } from "./types";

describe("IV_B_1 patterns", () => {
  it("generates 1001 five-stat patterns", () => {
    expect(generateB1Patterns()).toHaveLength(1001);
  });

  it("ensures every B_1 pattern sums to 10", () => {
    for (const pattern of generateB1Patterns()) {
      const total = STAT_KEYS.reduce((sum, stat) => sum + pattern[stat], 0);
      expect(total).toBe(10);
    }
  });
});

describe("IV_B_2 modes", () => {
  it("returns exactly one all-zero direct pattern", () => {
    const patterns = generateB2Patterns("direct");

    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns).toEqual([{ hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 }]);
  });

  it("returns 243 evolved-once patterns", () => {
    const patterns = generateB2Patterns("evolved_once");

    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns).toHaveLength(243);
  });

  it("keeps unknown mode lazy and safe", () => {
    const patterns = generateB2Patterns("unknown");

    expect(Array.isArray(patterns)).toBe(false);
    expect(isLazyPatternSource(patterns)).toBe(true);
    if (isLazyPatternSource(patterns)) {
      expect(patterns.estimatedCount).toBe(16 ** 5);
      const iterator = patterns[Symbol.iterator]();
      expect(iterator.next().value).toEqual({ hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 });
      expect(iterator.next().value).toEqual({ hp: 0, strength: 0, spirit: 0, defense: 0, speed: 1 });
    }
  });
});
