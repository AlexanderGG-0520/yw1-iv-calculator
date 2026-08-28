import { togenyanPortedEngine } from "./calculationEngine";
import { b2ValuesForStat } from "./patterns";
import { idealScoreForContext, resolveScoreProfile, scoreResult } from "./scoring";
import {
  STAT_KEYS,
  type IdealAchievementSummary,
  type ReverseResult,
  type SearchInput,
  type SearchResponse,
  type StatBlock,
  type StatCalculationEngine,
  type StatCandidate,
  type StatKey,
  type YokaiSpecies,
} from "./types";
import { getYokaiSpecies } from "./yokaiData";

const emptyStatBlock = (): StatBlock => ({
  hp: 0,
  strength: 0,
  spirit: 0,
  defense: 0,
  speed: 0,
});

function ivAValuesForSearch(engine: StatCalculationEngine, species: YokaiSpecies, stat: StatKey): number[] {
  return Array.from(engine.ivAValuesForStat?.(species, stat) ?? Array.from({ length: 32 }, (_, index) => index));
}

function medianFromScoreCounts(scoreCounts: Map<number, number>, totalCount: number): number {
  const lowerIndex = Math.floor((totalCount - 1) / 2);
  const upperIndex = Math.floor(totalCount / 2);
  let lowerScore: number | undefined;
  let upperScore: number | undefined;
  let seen = 0;

  for (const [score, count] of [...scoreCounts.entries()].sort(([left], [right]) => left - right)) {
    const end = seen + count;
    if (lowerScore === undefined && lowerIndex < end) {
      lowerScore = score;
    }
    if (upperIndex < end) {
      upperScore = score;
      break;
    }
    seen = end;
  }

  if (lowerScore === undefined || upperScore === undefined) {
    throw new Error("Unable to calculate median for candidate scores");
  }

  return (lowerScore + upperScore) / 2;
}

export function buildCandidatesForStat(
  input: SearchInput,
  stat: StatKey,
  engine: StatCalculationEngine = togenyanPortedEngine,
): StatCandidate[] {
  const species = getYokaiSpecies(input.speciesId);
  const candidates: StatCandidate[] = [];
  const b2Values = b2ValuesForStat(input.evolutionCount);
  const ivAValues = ivAValuesForSearch(engine, species, stat);

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
  const species = getYokaiSpecies(input.speciesId);
  const scoreProfile = resolveScoreProfile(input.scorePreset, input.customScoreWeights);
  const ivAMax = Object.fromEntries(
    STAT_KEYS.map((stat) => {
      const values = ivAValuesForSearch(engine, species, stat);
      return [stat, values.length > 0 ? Math.max(...values) : 0];
    }),
  ) as StatBlock;
  const idealScore = idealScoreForContext(ivAMax, input.evolutionCount, scoreProfile);
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
  const scoreCounts = idealScore !== null && idealScore > 0 ? new Map<number, number>() : null;
  let combinationsVisited = 0;
  let validCandidateCount = 0;
  let minScore = Number.POSITIVE_INFINITY;
  let maxScore = Number.NEGATIVE_INFINITY;
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
      const score = scoreResult(partial, scoreProfile);
      validCandidateCount += 1;

      if (scoreCounts) {
        scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
        minScore = Math.min(minScore, score);
        maxScore = Math.max(maxScore, score);
      }

      results.push({
        id: `${validCandidateCount}`,
        score,
        scoreProfile,
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

  let idealAchievement: IdealAchievementSummary | undefined;
  if (scoreCounts && idealScore !== null && validCandidateCount > 0) {
    const medianScore = medianFromScoreCounts(scoreCounts, validCandidateCount);
    idealAchievement = {
      idealScore,
      minPercent: (minScore / idealScore) * 100,
      medianPercent: (medianScore / idealScore) * 100,
      maxPercent: (maxScore / idealScore) * 100,
      complete: !truncated,
    };
  }

  return {
    results,
    summary: {
      perStatCandidateCounts,
      combinationsVisited,
      validCandidateCount,
      truncated,
      formulaStatus: engine.formulaStatus,
      idealAchievement,
    },
  };
}
