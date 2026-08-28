import { describe, expect, it } from "vitest";
import { b2ValuesForStat, generateB1Patterns, generateB2Patterns, isLazyPatternSource } from "./patterns";
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

describe("IV_B_2 evolution counts", () => {
  it("returns exactly one all-zero pattern for zero evolutions", () => {
    const patterns = generateB2Patterns(0);

    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns).toEqual([{ hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 }]);
  });

  it("returns 243 patterns after one evolution", () => {
    const patterns = generateB2Patterns(1);

    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns).toHaveLength(243);
    expect(b2ValuesForStat(1)).toEqual([1, 2, 3]);
  });

  it("accumulates B_2 across two evolutions", () => {
    const patterns = generateB2Patterns(2);

    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns).toHaveLength(3125);
    expect(b2ValuesForStat(2)).toEqual([2, 3, 4, 5, 6]);
  });

  it("keeps unknown evolution count lazy and safe", () => {
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

  it("rejects invalid known evolution counts", () => {
    expect(() => b2ValuesForStat(-1)).toThrow(RangeError);
    expect(() => b2ValuesForStat(1.5)).toThrow(RangeError);
  });
});
