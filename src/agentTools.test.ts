import { describe, expect, it } from "vitest";
import {
  calculateStatsTool,
  executeAgentTool,
  reverseIvTool,
  searchYokaiTool,
} from "./agentTools";
import { calculateStatBlock } from "./engine/forwardCalculation";

const zero = { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 };
const balancedB1 = { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 };

describe("agent tools", () => {
  it("searches the built-in Yo-kai catalog", () => {
    const result = searchYokaiTool({ query: "ジバニャン", limit: 10 });
    expect(result.results.some((species) => species.name === "ジバニャン")).toBe(true);
  });

  it("forward calculation shares the production engine and enforces B1 total", () => {
    const input = {
      speciesId: "jibanyan",
      level: 20,
      ivA: zero,
      ivB1: balancedB1,
      ivB2: zero,
      personalityMode: "none" as const,
    };
    const result = calculateStatsTool(input);
    expect(result.stats).toEqual(calculateStatBlock(input));

    expect(() =>
      calculateStatsTool({
        ...input,
        ivB1: { ...balancedB1, hp: 3 },
      }),
    ).toThrow(/total exactly 10/);
  });

  it("reverse_iv round-trips a forward-calculated candidate", () => {
    const input = {
      speciesId: "jibanyan",
      level: 20,
      ivA: zero,
      ivB1: balancedB1,
      ivB2: zero,
      personalityMode: "none" as const,
    };
    const observed = calculateStatBlock(input);
    const result = reverseIvTool({
      speciesId: input.speciesId,
      level: input.level,
      observed,
      personalityMode: input.personalityMode,
      evolutionCount: 0,
      scorePreset: "balanced",
      maxResults: 20,
    });

    expect(result.response.summary.validCandidateCount).toBeGreaterThan(0);
    expect(
      result.response.results.some(
        (candidate) =>
          JSON.stringify(candidate.ivA) === JSON.stringify(input.ivA) &&
          JSON.stringify(candidate.ivB1) === JSON.stringify(input.ivB1) &&
          JSON.stringify(candidate.ivB2) === JSON.stringify(input.ivB2),
      ),
    ).toBe(true);
  });

  it("rejects unknown tools", () => {
    expect(() => executeAgentTool("does_not_exist", {})).toThrow(/Unknown tool/);
  });
});
