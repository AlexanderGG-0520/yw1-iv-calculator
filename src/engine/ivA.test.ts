import { describe, expect, it } from "vitest";
import { ivAMaxForSpeciesStat, ivAValuesForSpeciesStat } from "./ivA";
import type { StatBlock, YokaiSpecies } from "./types";

const base: StatBlock = { hp: 1, strength: 1, spirit: 1, defense: 1, speed: 1 };

function species(ivAAllowed: YokaiSpecies["ivAAllowed"]): YokaiSpecies {
  return {
    id: "fixture",
    name: "fixture",
    base,
    growPattern: base,
    ivAAllowed,
  };
}

describe("IV_A candidate bounds", () => {
  it("uses 0 through 8 for a single allowed IV_A stat", () => {
    const fixture = species({ hp: false, strength: true, spirit: false, defense: false, speed: false });

    expect(ivAMaxForSpeciesStat(fixture, "strength")).toBe(8);
    expect(ivAValuesForSpeciesStat(fixture, "strength")).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ivAValuesForSpeciesStat(fixture, "hp")).toEqual([0]);
  });

  it("uses 0 through 4 per stat when two IV_A stats are allowed", () => {
    const fixture = species({ hp: true, strength: false, spirit: false, defense: false, speed: true });

    expect(ivAMaxForSpeciesStat(fixture, "hp")).toBe(4);
    expect(ivAMaxForSpeciesStat(fixture, "speed")).toBe(4);
    expect(ivAValuesForSpeciesStat(fixture, "speed")).toEqual([0, 1, 2, 3, 4]);
  });
});
