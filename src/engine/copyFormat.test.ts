import { describe, expect, it } from "vitest";
import { formatCandidateJson, formatCandidateText, formatStatLine } from "./copyFormat";
import type { ReverseResult, StatBlock, YokaiSpecies } from "./types";

const block = (hp: number, strength: number, spirit: number, defense: number, speed: number): StatBlock => ({
  hp,
  strength,
  spirit,
  defense,
  speed,
});

const species: YokaiSpecies = {
  id: "jibanyan",
  name: "ジバニャン",
  base: block(1, 2, 3, 4, 5),
  growPattern: block(0, 0, 0, 0, 0),
};

const result: ReverseResult = {
  id: "1",
  score: 42,
  ivA: block(0, 1, 2, 3, 4),
  ivB1: block(2, 2, 2, 2, 2),
  ivB2: block(0, 0, 1, 1, 2),
  calculated: block(80, 60, 45, 44, 58),
};

describe("copy formatting", () => {
  it("formats stat blocks in HP / strength / spirit / defense / speed order", () => {
    expect(formatStatLine(block(1, 2, 3, 4, 5))).toBe("1 / 2 / 3 / 4 / 5");
  });

  it("formats candidate text for notes and togenyan checking", () => {
    expect(
      formatCandidateText({
        species,
        level: 20,
        personalityMode: "none",
        result,
      }),
    ).toContain("妖怪: ジバニャン\nLv: 20\n性格ボーナス: none\nIV_A: 0 / 1 / 2 / 3 / 4");
  });

  it("includes custom personality bonus in JSON output", () => {
    const parsed = JSON.parse(
      formatCandidateJson({
        species,
        level: 20,
        personalityMode: "none",
        personalityBonus: block(20, 0, 0, 0, 0),
        result,
      }),
    );

    expect(parsed.personalityBonus).toEqual(block(20, 0, 0, 0, 0));
    expect(parsed.calculated).toEqual(result.calculated);
  });
});
