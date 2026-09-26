import { describe, expect, it } from "vitest";
import {
  AGENT_TOOL_DEFINITIONS,
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

  it("rejects calculate_stats IV_B_2 values above 15 and publishes the same schema bound", () => {
    const input = {
      speciesId: "jibanyan",
      level: 20,
      ivA: zero,
      ivB1: balancedB1,
      ivB2: { ...zero, hp: 16 },
      personalityMode: "none" as const,
    };

    expect(() => calculateStatsTool(input)).toThrow(/ivB2\.hp.*0 to 15/);

    const calculateTool = AGENT_TOOL_DEFINITIONS.find(
      (tool) => tool.name === "calculate_stats",
    );
    const properties = calculateTool?.inputSchema.properties as
      | Record<string, unknown>
      | undefined;
    const ivB2 = properties?.ivB2 as
      | { properties?: Record<string, { maximum?: number }> }
      | undefined;
    expect(ivB2?.properties?.hp?.maximum).toBe(15);
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

  it("rejects oversized evolution counts before reverse search", () => {
    expect(() =>
      reverseIvTool({
        speciesId: "jibanyan",
        level: 20,
        observed: { hp: 80, strength: 60, spirit: 45, defense: 45, speed: 58 },
        personalityMode: "none",
        evolutionCount: 6,
        scorePreset: "balanced",
        maxResults: 20,
      }),
    ).toThrow(/0 to 5/);
  });

  it("prevents reverse_iv from using the synchronous dispatcher", () => {
    expect(() => executeAgentTool("reverse_iv", {})).toThrow(/asynchronously/);
  });

  it("rejects unknown tools", () => {
    expect(() => executeAgentTool("does_not_exist", {})).toThrow(/Unknown tool/);
  });
});
