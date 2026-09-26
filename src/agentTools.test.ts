import { describe, expect, it } from "vitest";
import {
  AGENT_TOOL_DEFINITIONS,
  buildReverseIvToolResult,
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

  it("reverse_iv round-trips returned candidates through the forward engine", () => {
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
    const matchingCandidate = result.response.results.find(
      (candidate) =>
        JSON.stringify(candidate.ivA) === JSON.stringify(input.ivA) &&
        JSON.stringify(candidate.ivB1) === JSON.stringify(input.ivB1) &&
        JSON.stringify(candidate.ivB2) === JSON.stringify(input.ivB2),
    );
    expect(matchingCandidate).toBeDefined();
    expect(matchingCandidate?.verification).toEqual({
      method: "same_engine_forward_round_trip",
      exactMatch: true,
      matchedStatCount: 5,
      matchedStats: ["hp", "strength", "spirit", "defense", "speed"],
      recalculated: observed,
      mismatches: {},
    });
    expect(result.verification.checkedReturnedCandidateCount).toBe(
      result.response.results.length,
    );
    expect(result.verification.exactMatchReturnedCandidateCount).toBe(
      result.response.results.length,
    );
    expect(result.verification.allReturnedCandidatesExactMatch).toBe(true);
  });

  it("recalculates candidates instead of trusting reverseSearch calculated values", () => {
    const candidateInput = {
      speciesId: "jibanyan",
      level: 20,
      ivA: zero,
      ivB1: balancedB1,
      ivB2: zero,
      personalityMode: "none" as const,
    };
    const recalculated = calculateStatBlock(candidateInput);
    const observed = { ...recalculated, defense: recalculated.defense + 1 };
    const input = {
      speciesId: candidateInput.speciesId,
      level: candidateInput.level,
      observed,
      personalityMode: candidateInput.personalityMode,
      evolutionCount: 0 as const,
      scorePreset: "balanced" as const,
      maxResults: 20,
    };

    const result = buildReverseIvToolResult(input, {
      results: [
        {
          id: "1",
          score: 0,
          ivA: zero,
          ivB1: balancedB1,
          ivB2: zero,
          // Deliberately claim the search-side calculation matched observed.
          calculated: observed,
        },
      ],
      summary: {
        perStatCandidateCounts: zero,
        combinationsVisited: 1,
        validCandidateCount: 2,
        truncated: false,
        formulaStatus: "test",
      },
    });

    expect(result.response.results[0].verification).toEqual({
      method: "same_engine_forward_round_trip",
      exactMatch: false,
      matchedStatCount: 4,
      matchedStats: ["hp", "strength", "spirit", "speed"],
      recalculated,
      mismatches: {
        defense: {
          observed: observed.defense,
          recalculated: recalculated.defense,
          delta: -1,
        },
      },
    });
    expect(result.verification).toMatchObject({
      checkedReturnedCandidateCount: 1,
      exactMatchReturnedCandidateCount: 0,
      allReturnedCandidatesExactMatch: false,
      uniqueCandidate: false,
    });
  });

  it("only reports a unique candidate for a complete one-candidate search", () => {
    const input = {
      speciesId: "jibanyan",
      level: 20,
      observed: calculateStatBlock({
        speciesId: "jibanyan",
        level: 20,
        ivA: zero,
        ivB1: balancedB1,
        ivB2: zero,
        personalityMode: "none",
      }),
      personalityMode: "none" as const,
      evolutionCount: 0 as const,
      scorePreset: "balanced" as const,
      maxResults: 20,
    };
    const candidate = {
      id: "1",
      score: 0,
      ivA: zero,
      ivB1: balancedB1,
      ivB2: zero,
      calculated: input.observed,
    };
    const summary = {
      perStatCandidateCounts: zero,
      combinationsVisited: 1,
      validCandidateCount: 1,
      formulaStatus: "test",
    };

    expect(
      buildReverseIvToolResult(input, {
        results: [candidate],
        summary: { ...summary, truncated: false },
      }).verification.uniqueCandidate,
    ).toBe(true);

    expect(
      buildReverseIvToolResult(input, {
        results: [candidate],
        summary: { ...summary, truncated: true },
      }).verification.uniqueCandidate,
    ).toBe(false);
  });

  it("does not claim all returned candidates matched when no candidate was checked", () => {
    const input = {
      speciesId: "jibanyan",
      level: 20,
      observed: { hp: 1, strength: 1, spirit: 1, defense: 1, speed: 1 },
      personalityMode: "none" as const,
      evolutionCount: 0 as const,
      scorePreset: "balanced" as const,
      maxResults: 20,
    };

    const result = buildReverseIvToolResult(input, {
      results: [],
      summary: {
        perStatCandidateCounts: zero,
        combinationsVisited: 0,
        validCandidateCount: 0,
        truncated: false,
        formulaStatus: "test",
      },
    });

    expect(result.verification).toMatchObject({
      checkedReturnedCandidateCount: 0,
      exactMatchReturnedCandidateCount: 0,
      allReturnedCandidatesExactMatch: false,
      uniqueCandidate: false,
    });
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
