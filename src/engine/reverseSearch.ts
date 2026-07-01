import { togenyanPortedEngine } from "./calculationEngine";
import { b2ValuesForStat } from "./patterns";
import { scoreResult } from "./scoring";
import {
  STAT_KEYS,
  type ReverseResult,
  type SearchInput,
  type SearchResponse,
  type StatBlock,
  type StatCalculationEngine,
  type StatCandidate,
  type StatKey,
} from "./types";
import { getYokaiSpecies } from "./yokaiData";

const emptyStatBlock = (): StatBlock => ({
  hp: 0,
  strength: 0,
  spirit: 0,
  defense: 0,
  speed: 0,
});

export function buildCandidatesForStat(
  input: SearchInput,
  stat: StatKey,
  engine: StatCalculationEngine = togenyanPortedEngine,
): StatCandidate[] {
  const species = getYokaiSpecies(input.speciesId);
  const candidates: StatCandidate[] = [];
  const b2Values = b2ValuesForStat(input.b2Mode);
  const ivAValues = engine.ivAValuesForStat?.(species, stat) ?? Array.from({ length: 32 }, (_, index) => index);

  for (const ivA of ivAValues) {
    for (let ivB1 = 0; ivB1 <= 10; ivB1 += 1) {
      for (const ivB2 of b2Values) {
        const calculated = engine.calculate({
          species,
          stat,
          level: input.level,
          ivA,
          ivB1,
          ivB2,
          personalityMode: input.personalityMode,
          personalityBonus: input.personalityBonus,
        });

        if (calculated === input.observed[stat]) {
          candidates.push({ stat, ivA, ivB1, ivB2, calculated });
        }
      }
    }
  }

  return candidates;
}

export function reverseSearch(
  input: SearchInput,
  engine: StatCalculationEngine = togenyanPortedEngine,
): SearchResponse {
  const maxResults = Math.max(1, Math.min(input.maxResults, 500));
  const perStatCandidates = Object.fromEntries(
    STAT_KEYS.map((stat) => [stat, buildCandidatesForStat(input, stat, engine)]),
  ) as Record<StatKey, StatCandidate[]>;
  const perStatCandidateCounts = Object.fromEntries(
    STAT_KEYS.map((stat) => [stat, perStatCandidates[stat].length]),
  ) as StatBlock;
  const working = {
    ivA: emptyStatBlock(),
    ivB1: emptyStatBlock(),
    ivB2: emptyStatBlock(),
    calculated: emptyStatBlock(),
  };
  const results: ReverseResult[] = [];
  let combinationsVisited = 0;
  let truncated = false;
  const maxCombinations = 2_000_000;

  function visit(statIndex: number, b1Total: number): void {
    if (truncated) {
      return;
    }

    if (combinationsVisited >= maxCombinations) {
      truncated = true;
      return;
    }

    if (statIndex === STAT_KEYS.length) {
      combinationsVisited += 1;
      if (b1Total !== 10) {
        return;
      }

      const partial = {
        ivA: { ...working.ivA },
        ivB1: { ...working.ivB1 },
        ivB2: { ...working.ivB2 },
        calculated: { ...working.calculated },
      };
      const score = scoreResult(partial, input.scorePreset);
      results.push({
        id: `${results.length + 1}`,
        score,
        ...partial,
      });
      results.sort((left, right) => right.score - left.score);
      if (results.length > maxResults) {
        results.length = maxResults;
      }
      return;
    }

    const stat = STAT_KEYS[statIndex];
    const remainingStats = STAT_KEYS.length - statIndex - 1;
    for (const candidate of perStatCandidates[stat]) {
      const nextB1Total = b1Total + candidate.ivB1;
      if (nextB1Total > 10) {
        continue;
      }
      if (nextB1Total + remainingStats * 10 < 10) {
        continue;
      }

      working.ivA[stat] = candidate.ivA;
      working.ivB1[stat] = candidate.ivB1;
      working.ivB2[stat] = candidate.ivB2;
      working.calculated[stat] = candidate.calculated;
      visit(statIndex + 1, nextB1Total);
    }
  }

  visit(0, 0);

  return {
    results,
    summary: {
      perStatCandidateCounts,
      combinationsVisited,
      truncated,
      formulaStatus: engine.formulaStatus,
    },
  };
}
